document.getElementById('file-input').addEventListener('change', async  function (event) {
  const file = event.target.files[0];

  document.getElementById('filename').innerHTML = file.name
  document.getElementById('filename').hidden = ''

  if (file.type == 'application/pdf') {
    document.getElementById('convert-pdf').checked = 'true'
  }
  document.getElementById('convert-btn').disabled = ''
});

document.getElementById('convert-btn').addEventListener('click', async ()=>{
  const file = document.getElementById('file-input').files[0]
  const email = document.getElementById('email').value

  const formData = new FormData();

  formData.append('file', file);
  formData.append('email', email)
  if (document.getElementById('convert-pdf').checked) {
    formData.append('convertPdf', true)
  }

  await fetch('/run/script2msd', {
      method: 'POST',
      body: formData
  });
})