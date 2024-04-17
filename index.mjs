import express from 'express';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs/promises';


import treatmentor from './lib/treatmentor.mjs'
import scheduler from './lib/scheduler.mjs'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3002;
const scriptFilePath = path.join(__dirname, 'public', 'script.json');
const treatmentFilePath = path.join(__dirname, 'public', 'treatment.txt');

const upload = multer({storage: multer.memoryStorage() });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')))

app.post('/run/treatmentor', async (req, res) => {
    let scriptJson;
    let treatmentText;

    try {
        scriptJson = treatmentor.jsonToString(JSON.parse(await fs.readFile(scriptFilePath)));
        treatmentText = await fs.readFile(treatmentFilePath);
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }


    const stream = await treatmentor.scriptToTreatment(scriptJson, { role:'user', content: `EXAMPLE(s): ${treatmentText}` })

    for await (const chunk of stream) {
        const delta = (chunk.choices[0]?.delta?.content || "").replace(/\*/g, '')

        res.write(delta);
    }


    return res.end()
})

app.post('/run/scheduler', async (req, res) => {
    const prompt = req.body.prompt;
    let scriptJson;
    let scriptFormatted;
    let orderedScenes;

    if (!prompt) {
        return res.status(400).json({ error: 'missing parameter "prompt"'})
    }

    try {
        scriptJson = JSON.parse(await fs.readFile(scriptFilePath));
        scriptFormatted = scheduler.jsonToString(scriptJson)
        orderedScenes = JSON.parse(await scheduler.scheduleScript(scriptFormatted, prompt))
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }

    if (orderedScenes.error) {
        return res.status(500).json({ error: orderedScenes.error })
    }

    await fs.writeFile(scriptFilePath, JSON.stringify(scheduler.createScriptJson(scriptJson, orderedScenes)))

    return res.status(200).json({ status: 200 })
})

app.post('/upload/json', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({error: 'No files were uploaded.'});
    }
    const file = req.file.buffer;

    await fs.writeFile(scriptFilePath, file);
    res.json({ status: 200 })
})

app.post('/upload/txt', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({error: 'No files were uploaded.'});
    }
    const file = req.file.buffer;

    await fs.writeFile(treatmentFilePath, file);
    res.json({ status: 200 })
})


app.listen(port, 'localhost', () => { console.log(`http://localhost:${port}`); });