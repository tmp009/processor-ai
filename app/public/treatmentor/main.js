const errorMessage = document.getElementById('error');
const uploadButtonJson = document.getElementById('file-button-json')
const uploadButtonTxt = document.getElementById('file-button-txt')
const pre = document.querySelector('pre')



document.getElementById('run-prompt').addEventListener('click', async (e) => {
    pre.textContent = ''
    errorMessage.textContent = '';
    e.target.disabled = 'true';
    uploadButtonJson.disabled = 'true';
    uploadButtonTxt.disabled = 'true';

    const response = await fetch('/run/treatmentor', {
        method: 'POST',
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ userPrompt: document.getElementById('user-prompt').value })
    });

    try {
        for await (const chunk of  fetchStream(response)) {
            pre.textContent += new TextDecoder().decode(chunk)
        }
    } catch  {
        errorMessage.textContent = (await response.json()).error;
    }

    e.target.disabled = '';
    uploadButtonJson.disabled = '';
    uploadButtonTxt.disabled = '';

});

document.addEventListener('DOMContentLoaded', async () => {
    const json = await getScript();

    document.querySelector('pre').textContent = JSON.stringify(json, null, 4)
})

document.getElementById('file-input-json').addEventListener('change', async  function (event) {
    const file = event.target.files[0];

    const formData = new FormData();

    formData.append('file', file);

    await fetch('/upload/json', {
        method: 'POST',
        body: formData
    });


    location.reload();
});

document.getElementById('file-input-txt').addEventListener('change', async  function (event) {
    const file = event.target.files[0];

    const formData = new FormData();

    formData.append('file', file);

    await fetch('/upload/txt', {
        method: 'POST',
        body: formData
    });


    location.reload();
});

document.getElementById('save-btn').addEventListener('click', () => {
    const fileName = 'treated.txt';

    const blob = new Blob([pre.textContent], { type: 'text/plain' });

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
})


async function getScript() {
    const res = await fetch('/script.json', {method: 'GET' })
    const json = await res.json();

    return json
}

async function* fetchStream(response) {
    try {

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const reader = response.body.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield value;
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  }