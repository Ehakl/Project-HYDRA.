document.addEventListener('DOMContentLoaded', async () => {
  const token = await chrome.storage.local.get('hydra_token');
  const statusDiv = document.getElementById('auth-status');
  
  if (!token.hydra_token) {
    statusDiv.innerHTML = 'Not logged in. Please login via the Hydra Dashboard first.';
    return;
  }
  statusDiv.innerHTML = 'Authenticated ✅';

  document.getElementById('save-btn').addEventListener('click', async () => {
    const title = document.getElementById('title').value;
    const content = document.getElementById('content').value;
    const msg = document.getElementById('message');

    if (!title || !content) {
      msg.innerText = 'Please fill both fields.';
      return;
    }

    try {
      // We send a JSON payload to the Gateway. 
      // Note: For JSON, we must use application/json, NOT multipart/form-data.
      const res = await fetch('http://localhost/api/docs/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.hydra_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title, content })
      });

      if (res.ok) {
        msg.innerText = 'Saved successfully!';
        // Clear the form
        document.getElementById('title').value = '';
        document.getElementById('content').value = '';
      } else {
        const error = await res.json();
        msg.innerText = `Error: ${error.detail || error.error}`;
      }
    } catch (err) {
      msg.innerText = 'Failed to connect to Hydra Gateway.';
    }
  });
});