import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BauhausLogo } from '../components/studio/BauhausLogo';

type Status = 'idle' | 'uploading' | 'uploaded' | 'ingesting' | 'done' | 'error';

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [uploadedFilename, setUploadedFilename] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [ingestLog, setIngestLog] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setStatus('idle');
    setMessage('');
    setIngestLog('');
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    setMessage('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/upload', { method: 'POST', body: form });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || res.statusText);
      }
      const data = await res.json();
      setUploadedFilename(data.filename || file.name);
      setStatus('uploaded');
      setMessage(`Uploaded: ${data.filename || file.name}`);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Upload failed');
    }
  };

  const handleIngest = async () => {
    if (!uploadedFilename) return;
    setStatus('ingesting');
    setIngestLog('');
    try {
      const form = new FormData();
      form.append('file', uploadedFilename);
      const res = await fetch('/ingest?skip_envision=true', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || res.statusText);
      }
      const data = await res.json();
      setStatus('done');
      setIngestLog(JSON.stringify(data, null, 2));
      setMessage('Ingestion complete');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Ingestion failed');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F0F0F0]">
      {/* Header */}
      <header className="bg-[#1040C0] border-b-4 border-[#121212] shadow-bauhaus-md">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BauhausLogo size="lg" />
              <div>
                <h1 className="font-display text-white leading-[0.9] tracking-tighter">
                  Upload
                </h1>
                <p className="text-white/90 text-sm sm:text-base font-medium mt-1 tracking-wide">
                  Upload &amp; ingest a screenplay
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
              className="bg-white text-[#121212] border-[#121212] shadow-bauhaus-sm"
            >
              Back to Scenes
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white border-4 border-[#121212] shadow-bauhaus-lg p-6 sm:p-8 space-y-6">

          {/* Step 1: Select file */}
          <div>
            <h2 className="font-label text-[#121212] text-sm tracking-widest mb-3">
              1 &mdash; Select Screenplay PDF
            </h2>
            <div
              className="border-4 border-dashed border-[#121212]/30 p-8 text-center cursor-pointer
                         hover:border-[#1040C0] hover:bg-[#1040C0]/5 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.fountain"
                className="hidden"
                onChange={handleFileChange}
              />
              {file ? (
                <div>
                  <div className="w-12 h-12 mx-auto mb-3 bg-[#1040C0] border-2 border-[#121212] flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="font-bold uppercase text-sm text-[#121212]">{file.name}</p>
                  <p className="text-xs text-[#121212]/60 font-medium mt-1">
                    {(file.size / 1024).toFixed(1)} KB &mdash; click to change
                  </p>
                </div>
              ) : (
                <div>
                  <div className="w-12 h-12 mx-auto mb-3 bg-[#E0E0E0] border-2 border-[#121212] flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#121212]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <p className="font-bold uppercase text-sm text-[#121212]/50">
                    Click to select a file
                  </p>
                  <p className="text-xs text-[#121212]/40 font-medium mt-1">PDF, TXT, or Fountain</p>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Upload */}
          <div>
            <h2 className="font-label text-[#121212] text-sm tracking-widest mb-3">
              2 &mdash; Upload to Server
            </h2>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="w-full"
              disabled={!file || status === 'uploading'}
              onClick={handleUpload}
            >
              {status === 'uploading' ? 'Uploading...' : 'Upload'}
            </Button>
          </div>

          {/* Step 3: Ingest */}
          <div>
            <h2 className="font-label text-[#121212] text-sm tracking-widest mb-3">
              3 &mdash; Ingest Screenplay
            </h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={status !== 'uploaded' && status !== 'done'}
              onClick={handleIngest}
            >
              {status === 'ingesting' ? 'Ingesting...' : 'Ingest'}
            </Button>
          </div>

          {/* Status message */}
          {message && (
            <div
              className={`p-4 border-4 border-[#121212] font-bold text-sm ${
                status === 'error'
                  ? 'bg-[#D02020] text-white'
                  : status === 'done'
                    ? 'bg-[#1040C0] text-white'
                    : 'bg-[#F0C020] text-[#121212]'
              }`}
            >
              {message}
            </div>
          )}

          {/* Ingest log */}
          {ingestLog && (
            <div>
              <h3 className="font-label text-[#121212] text-sm tracking-widest mb-2">Output</h3>
              <pre className="bg-[#121212] text-[#F0C020] text-xs font-mono p-4 border-4 border-[#121212] overflow-x-auto max-h-64 overflow-y-auto">
                {ingestLog}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#121212] border-t-4 border-[#121212] px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-end text-sm">
          <span className="font-bold uppercase tracking-widest text-white/50">Whatif Studio</span>
        </div>
      </footer>

      {/* Ingesting overlay */}
      {status === 'ingesting' && (
        <div className="fixed inset-0 bg-[#121212]/60 flex items-center justify-center z-50">
          <div className="bg-white border-4 border-[#121212] shadow-bauhaus-lg p-8 text-center max-w-sm mx-4">
            <div className="w-12 h-12 border-4 border-[#121212] border-t-[#D02020] rounded-full animate-spin mx-auto mb-4" />
            <p className="font-bold uppercase tracking-widest text-[#121212]">Ingesting screenplay</p>
            <p className="text-sm font-medium text-[#121212]/70 mt-2">This may take a while</p>
          </div>
        </div>
      )}
    </div>
  );
};
