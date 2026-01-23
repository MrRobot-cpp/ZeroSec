const API_URL = 'http://localhost:5200/canary/watermark';

const watermarkDocument = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(API_URL, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    let errMsg = 'Failed to watermark document.';
    try {
      const data = await res.json();
      errMsg = data.error || errMsg;
    } catch {}
    throw new Error(errMsg);
  }
  const blob = await res.blob();
  const canaryId = res.headers.get('X-Canary-ID');
  const outputPath = res.headers.get('X-Output-Path');
  let filename = 'watermarked_file';
  const contentDisp = res.headers.get('Content-Disposition');
  if (contentDisp) {
    const match = contentDisp.match(/filename="(.+)"/);
    if (match) filename = match[1];
  }
  return { blob, filename, canaryId, outputPath };
};

export default { watermarkDocument };
