require('dotenv').config()

const { readFile, writeFile } = require('fs/promises')

async function pdf2Txt(filepath, outPath) {
    const body = new FormData();
    const blob = new Blob([await readFile(filepath)]);
    body.set("file", blob, 'data.pdf');

    const res = await fetch(process.env.PDF_CONVERT_SERVICE, { body: body, method: 'POST' })

    await writeFile(outPath, res.body)
}

module.exports = { pdf2Txt }