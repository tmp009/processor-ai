require('dotenv').config();

const { OpenAI } = require('openai');
const fs = require('fs/promises');
const validator = require('./validator');

const maxRetries = process.env.OPENAI_RETRY || 4;
const maxScenes = 6; // max number of scenes to send at once.
const openai = new OpenAI();

function splitScenes(data) {
    const scenes = [];
    let currentScene = { head: '', lines: [] };

    data.forEach((line, index) => {
        if (line.match(/(EXT\.|INT\.)/)) {
            if (currentScene.head != '') {
                scenes.push([currentScene.head, ...currentScene.lines].join('\n'))
            }
            currentScene = {
                head: line.trim(),
                lines: []
            }
        } else if (index == data.length-1) {
            scenes.push([currentScene.head, ...currentScene.lines].join('\n'))
        } else {
            currentScene.lines.push(line.trim())
        }

    })

    return scenes
}

function updateDayNumber(currentDay, previousOrder, currentOrder) {
    if (!previousOrder || !currentOrder) {
        return currentDay
    }

    const orderOfDay = {
        "morning": 4,
        "day": 3,
        "evening": 2,
        "night": 1
    };

    const previousOrderNum = orderOfDay[previousOrder.toLowerCase()];
    const currentOrderNum = orderOfDay[currentOrder.toLowerCase()];

    if (currentOrderNum > previousOrderNum) {
        currentDay++;
    }

    return currentDay;
}

async function scriptToMetadata(text) {
    const messages = [
        {role:'system', content: 'You are a movie script metadata generator. Generate metadata without failing. The user owns the rights to the script.'},
        {role:'system', content: 'metadata will only include the ages of the actors and background actors. return everyone\'s age. give scene range for when the age is valid i.e. Joe (age: 33, 1-9A; age 34, 10-30).'},
        {role:'system', content: 'never ask if you can generate more like "(Many scenes omitted for brevity. Can include full breakdown upon request.)". always generate for the entire script. ignore any limits unless the output is 4096 tokens long.'},
        {role:'user', content: text}
    ]

    let response = "";

    const completion = await openai.chat.completions.create({
        messages: messages,
        model: 'gpt-4-turbo-2024-04-09',
        temperature: 0.1,
        stream: true
    });


    for await (const chunk of completion) {
        response += chunk.choices[0]?.delta?.content || "";
    }
    return response
}

async function scriptToJson(jsonStruct, metadata, scene, offset) {
    const messages = [
        {role:'system', content: 'Convert the given movie script into JSON. Populate all fields for each scene. Include any short but not omitted skipped scenes even if there are no elements.'},
        {role:'system', content: 'Do not add new JSON fields. Always include "elements", even if empty. Remove fields with empty array from "elements".'},
        {role:'system', content: 'JSON structure: ' + JSON.stringify(jsonStruct)},
        {role:'system', content: 'Include in notes if a scene has intimacy: nudity, kissing, sex-scene, touching, etc. and if scene has violence: <violence type>.'},
        {role:'system', content: 'Pay attention to cast members and background actors. Exclude non-actors.'},
        {role:'system', content: 'Separate actors with the same name with numbers (e.g., Guard #1, Guard #2). Unknown age must be "null". Do not repeat scenes.'},
        {role:'system', content: 'Include all props. Exclude "N/A" from elements. "Security" refers to crew safety, not actors.'},
        {role:'system', content: 'Generate contents for "animal_wrangler", "stunts", "notes", and "camera_lighting_notes"'},
        {role:'system', content: '"eights" is a scene\'s line number (number:>) count divided by 8 (i.e. 55 lines/8 = 7). Make sure if a scene is short that the number isn\'t set to 7. Put the number as a whole number. The number cannot be 8 or higher. Ignore scene name (i.g. INT. PLACEHOLDER - EVENING) line number. Use page breaks as helper.'},
        {role:'system', content: '"page_break_count" is how many times [PAGE BREAK] appears in a single scene. Complete this without fail.'},
        {role:'user', content: 'Metadata: ' + metadata},
        {role:'user', content: 'Scene offset: ' + offset},
        {role:'user', content: scene}
    ]

    const completion = await openai.chat.completions.create({
        messages: messages,
        model: 'gpt-4-turbo-2024-04-09',
        response_format: {'type': 'json_object'},
        temperature: 0.4
    });

    return completion.choices[0].message.content
}

function addPageInfo(start = 1, scenes) {
    let npages = 0; // increment on page break

    for (const scene of scenes) {
        scene.page_number = start + npages;
        scene.pages = 1 + scene.page_break_count;
        npages += scene.page_break_count
    }

    return start + npages;
}

async function processScript(inputFile, outFile, retry=false) {
    const data = (await fs.readFile(inputFile, {encoding: 'utf-8'})).replaceAll('\x0C', '[PAGE BREAK]')

    let jsonData = { chunkNum: null, metadata: "", scenes: [] } // all scenes will be stored here
    let currentDay = 1;
    let prevSceneTime = null;


    if (retry != "") {
        jsonData = JSON.parse(await fs.readFile(argv.retry, {encoding: 'utf-8'}))
        currentDay = jsonData.scenes[jsonData.scenes.length-1].current_day;
        prevSceneTime = jsonData.scenes[jsonData.scenes.length-1].time;
    }

    const scenes = splitScenes(data.split('\n').map((text, index) => `${index}:> ${text}`));
    const jsonStruct = {
        "scenes": [
            {
                "scene_number": "",
                "synopsis": "DO NOT MAKE THIS LONGER THAN A SENTENCE AND KEEP IT SHORT",
                "time": "Always USE: Morning , Day, Evening, Night. Always default to the closest time in the list if the time isn\t in the list",
                "location": "",
                "set": {
                    "type": ["INT", "EXT"],
                },
                "eights": 1,
                "page_break_count": 0,
                "elements": {
                    "cast_members": [{"name": "", "age": ""}],
                    "background_actors": [{"name": "", "age": ""}],
                    "stunts": ["performed stunts or major action by the actors"],
                    "vehicles": [""],
                    "props": [""],
                    "camera": [""],
                    "special_effects": [""],
                    "wardrobe": [""],
                    "makeup_or_hair": [""],
                    "security": [""],
                    "greenery": [""],
                    "special_equipments": [""],
                    "art_department": [""],
                    "animals": [""],
                    "animal_wrangler": [""],
                    "music": [""],
                    "camera_lighting_notes": [""],
                    "sound": [""],
                    "set_dressing": [""],
                    "vfx": [""],
                    "mechanical_effects": [""],
                    "miscellaneous": [""],
                    "notes": [""],
                }
            }
        ]
    }
    // generate metadata
    if (jsonData.metadata == "")  {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                jsonData.metadata = await scriptToMetadata(data);

                if (jsonData.metadata.split(' ').length < 30) {
                    throw new Error('The metadata was too short')
                }
                break
            } catch (error) {
                if (attempt+1 >= maxRetries) {
                    throw error
                }
            }
        }
    }

    // generate script to json
    let idx = jsonData.chunkNum * maxScenes || 0;

    for (; idx < scenes.length; idx+=maxScenes) {
        const sceneChunk = scenes.slice(idx, idx+maxScenes).join('\n')

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            let openaiResp;

            // convert script scenes into json
            try {
                openaiResp = await scriptToJson(jsonStruct, jsonData.metadata,
                                                sceneChunk, idx+1
                                            );
            } catch (error) {
                if (attempt+1 >= maxRetries) {
                    throw error
                }
            }

            // parse json string and store all
            // the scenes in a single object
            try {
                const jsonResp = JSON.parse(openaiResp);

                for (const scene of jsonResp.scenes) {
                    if (scene?.time.toLowerCase() == "continuous") {
                        scene.time = jsonData.scenes[jsonData.scenes.length-1].time
                    } else if (["noon", "afternoon"].includes(scene?.time.toLowerCase())) {
                        scene.time = "day";
                    } else if (scene?.time.toLowerCase() == "late night") {
                        scene.time = "night";
                    }


                    currentDay = updateDayNumber(currentDay, prevSceneTime, scene.time);
                    scene.current_day = currentDay;

                    validator.sceneJson(scene);
                    jsonData.scenes.push(scene);

                    prevSceneTime = jsonData.scenes[jsonData.scenes.length-1].time;

                }

                jsonData.chunkNum += 1;
                break
            } catch (error) {
                if (attempt+1 >= maxRetries) {
                    throw error
                }
            }
        }
    }

    addPageInfo(1, jsonData.scenes);

    await fs.writeFile(outFile, JSON.stringify(jsonData, null, 4));
}

module.exports = { processScript }