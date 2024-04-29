document.getElementById('run-prompt').addEventListener('click', async (e) => {
    const errorMessage = document.getElementById('error');
    const uploadButton = document.getElementById('file-button')

    errorMessage.textContent = '';
    e.target.disabled = 'true';
    uploadButton.disabled = 'true';

    const res = await fetch('/run/scheduler', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: document.getElementById('prompt-textarea').value })
    });

    e.target.disabled = '';
    uploadButton.disabled = ''

    if (res.ok) {
        const json = await getScript();
        document.querySelector('pre').textContent = JSON.stringify(json, null, 4)
    } else {
        document.getElementById('error').textContent = (await res.json()).error
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const json = await getScript();

    document.querySelector('pre').textContent = JSON.stringify(json, null, 4)
})

document.getElementById('file-input').addEventListener('change', async  function (event) {
    const file = event.target.files[0];

    const formData = new FormData();

    formData.append('file', file);

    await fetch('/upload/json', {
        method: 'POST',
        body: formData
    });


    location.reload();
});

async function getScript() {
    const res = await fetch('/script.json', {method: 'GET' })
    const json = await res.json();

    return json
}