import 'dotenv/config';
import { OpenAI } from 'openai';

const openai = new OpenAI();

async function scriptToTreatment(script, treatments) {
    const messages = [
        {role:'system', content: 'You are film treatmentor. You will take example film treatments and a movie script then generate a film treatment for the script similar to the example treatments. Do not output markdown.'},
        {role:'user', content: 'Treatments: ' + treatments},
        {role:'user', content: 'Script content: ' + script},

    ]

    const stream = await openai.chat.completions.create({
        messages: messages,
        model: 'gpt-4-turbo',
        stream: true,
        temperature: 0.7
    });

    return stream
}

function jsonToString(scriptJson) {
    let script = "";
    const sceneText = []

    script += 'METADATA: ' + scriptJson.metadata + '\n';

    for (const scene of scriptJson.scenes) {
        sceneText.push(`${scene.scene_number}. ${scene.set.type.join('/')}  ${scene.location}\nSynopsis: ${scene.synopsis}\n`);
    }

    return script + sceneText.join('\n');
}

export default { scriptToTreatment, jsonToString }