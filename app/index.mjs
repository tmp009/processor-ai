import 'dotenv/config';

import express from 'express';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs/promises';

import treatmentor from './lib/treatmentor.mjs'
import scheduler from './lib/scheduler.mjs'
import { deleteFile } from './lib/utils.js'
import { processScript } from './lib/process.js';
import { runRobot } from './lib/robot.js';
import { pdf2Txt } from './lib/pdf2txt.js';
import { sendMail } from './lib/email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;
const scriptFilePath = path.join(__dirname, 'public', 'script.json');
const treatmentFilePath = path.join(__dirname, 'public', 'treatment.txt');

const tmpStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const tmpDir = path.join(__dirname, 'tmp');
      cb(null, tmpDir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}.tmp`);
    }
});

const uploadTmp = multer({storage: tmpStorage });
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')))

app.post('/run/treatmentor', async (req, res) => {
    let scriptJson;
    let treatmentText;

    const userPrompt = req.body.userPrompt;

    try {
        scriptJson = treatmentor.jsonToString(JSON.parse(await fs.readFile(scriptFilePath)));
        treatmentText = await fs.readFile(treatmentFilePath);
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }


    const stream = await treatmentor.scriptToTreatment(scriptJson,  `EXAMPLE(s): ${treatmentText}`, userPrompt)

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
        return res.status(400).json({ error: 'missing parameter "prompt"' })
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
        return res.status(400).json({ error: 'No files were uploaded.' });
    }
    const file = req.file.buffer;

    await fs.writeFile(scriptFilePath, file);
    res.json({ status: 200 })
})

app.post('/upload/txt', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No files were uploaded.' });
    }
    const file = req.file.buffer;

    await fs.writeFile(treatmentFilePath, file);
    res.json({ status: 200 })
})

app.post('/run/script2msd', uploadTmp.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({error: 'No files were uploaded.'});
    }

    const email = req.body.email;

    if (!email) {
        return res.status(400).json({ error: 'email key missing'})
    }

    await sendMail(email, 'Movie AI Script2Msd', 'Hello,\n\nYour movie script is being processed. You will receive an email once it\'s done.\n\nThis email has been sent to you automatically.')

    const file = req.file.path;
    const fileOutJson = req.file.path + '_out.json';
    const fileOutMsd = req.file.path + '_out.msd';

    try {
        if (req.body.convertPdf) {
          await pdf2Txt(file, file)
        }

        res.json({ status: 200 })

        await processScript(file, fileOutJson, false);
        await runRobot(
          process.env.CONTROL_SERVER_MMS_URL || 'host.docker.internal',
          process.env.CONTROL_SERVER_MMS_PORT,
          fileOutJson,
          fileOutMsd,
          false
        )

        await sendMail(email, '[DONE] Movie AI Script2Msd', 'Here is your processed msd & json file', [
            {
                filename: 'processed.msd',
                content: await fs.readFile(fileOutMsd)
            },
            {
              filename: 'processed.json',
              content: await fs.readFile(fileOutJson)
            }])


    } catch (error) {
        console.error(error);

        await sendMail(email, '[ERROR] Movie AI Script2Msd', 'Hello,\n\n We encountered an error when converting this file. Please try uploading the file again or contact this email for assistance.')

        return res.status(400).json({ error: error });

    } finally {
        await deleteFile(file);
        await deleteFile(fileOutJson);
        await deleteFile(fileOutMsd);
    }
})



app.listen(port, '0.0.0.0', () => { console.log(`http://0.0.0.0:${port}`); });
