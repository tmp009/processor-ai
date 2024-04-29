import 'dotenv/config';

import { OpenAI } from 'openai';

const openai = new OpenAI();


function createScriptJson(original, orderedScenes) {
    const newScriptJson = {
        chunkNum: original.chunkNum,
        metadata: original.metadata,
        scenes: []
    }

    for (const sceneNumber of orderedScenes.scenes) {
        const scene = original.scenes.find(s => s.scene_number == sceneNumber);

        if (!scene) {
            break;
        }

        newScriptJson.scenes.push(scene);
    }

    for (const s of original.scenes) {
        if (!s) {
            continue
        }

        if (!orderedScenes.scenes.includes(String(s.scene_number))) {
            newScriptJson.scenes.push(s.scene_number);
        }
    }

    return newScriptJson
}

async function scheduleScript(script, prompt) {
    const messages = [
        {role:'system', content: 'You are film scheduler. You will rearrange movie scenes in the requested manner. You will take a movie script and return JSON object with key "scenes" which is an array containing scene numbers as string. Do not handle vague tasks or impossible task. add key "error" with a string explaining the error. NEVER put the same scene more than once. Always return all scene numbers even if unaffected. Do not delete or ommit scenes unless explictly asked'},
        {role:'system', content: 'You can for example order by time (morning, day, evening, night), location/set, synopis, etc.'},
        {role:'user', content: 'Script content: ' + script},
        {role:'user', content: prompt},
    ]

    const completion = await openai.chat.completions.create({
        messages: messages,
        model: 'gpt-4-turbo-2024-04-09',
        temperature: 0.7,
        response_format: { type: 'json_object' }
    });

    return completion.choices[0].message.content;
}

function jsonToString(scriptJson) {
    let script = "";
    const sceneTexts = []

    for (const scene of scriptJson.scenes) {
        if (!scene) {
            continue
        }

        let sceneText = `${scene.scene_number}. ${typeof scene?.set?.type !== 'undefined' ? scene.set.type.join('/') : ''} TIME: ${scene.time}; LOCATION: ${scene.location};\nSynopsis: ${scene.synopsis}\n`
        sceneTexts.push(sceneText);
    }

    return script + sceneTexts.join('\n');
}

export default { jsonToString, scheduleScript, createScriptJson }