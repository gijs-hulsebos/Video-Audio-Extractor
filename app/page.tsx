'use client';

import { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { UploadCloud, FileAudio, Download, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Format = 'mp3' | 'wav' | 'aac';

export default function VideoToAudioConverter() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<Format>('mp3');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ffmpegRef.current = new FFmpeg();
    load();
  }, []);

  const load = async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg) return;
    
    ffmpeg.on('progress', ({ progress, time }) => {
      setProgress(Math.max(0, Math.min(100, Math.round(progress * 100))));
    });

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      setIsLoaded(true);
    } catch (err) {
      console.error('Error loading FFmpeg:', err);
      setError('Failed to load media engine. Please try refreshing.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('video/')) {
        handleFileSelect(droppedFile);
      } else {
        setError('Please upload a valid video file.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    setError(null);
    setFile(selectedFile);
    setOutputUrl(null);
    setOutputSize(null);
    setProgress(0);
  };

  const convertFile = async () => {
    if (!file || !isLoaded || !ffmpegRef.current) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);

    const ffmpeg = ffmpegRef.current;
    const inputName = `input.${file.name.split('.').pop()}`;
    const outputName = `output.${format}`;

    try {
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      let ffmpegArgs: string[] = [];
      
      if (format === 'mp3') {
        ffmpegArgs = ['-i', inputName, '-vn', '-b:a', '320k', outputName];
      } else if (format === 'wav') {
        ffmpegArgs = ['-i', inputName, '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', outputName];
      } else if (format === 'aac') {
        ffmpegArgs = ['-i', inputName, '-vn', '-c:a', 'aac', '-b:a', '256k', outputName];
      }

      await ffmpeg.exec(ffmpegArgs);

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data as any], { type: `audio/${format}` });
      const url = URL.createObjectURL(blob);
      
      setOutputUrl(url);
      setOutputSize((blob.size / (1024 * 1024)).toFixed(2) + ' MB');
    } catch (err) {
      console.error('Conversion error:', err);
      setError('An error occurred during conversion.');
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setOutputUrl(null);
    setOutputSize(null);
    setProgress(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#EDEDED] font-sans selection:bg-[#333333] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[600px] space-y-8">
        
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-medium tracking-tight">Video to Audio</h1>
          <p className="text-[#888888] text-sm">Extract high-fidelity audio from any video file.</p>
        </div>

        {/* Main Card */}
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-8 shadow-2xl">
          
          {error && (
            <div className="mb-6 p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {!file ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {/* Upload Dropzone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative group cursor-pointer flex flex-col items-center justify-center py-16 px-6
                    border-2 border-dashed rounded-xl transition-all duration-500 ease-out
                    ${isDragging ? 'border-[#EDEDED] bg-[#1A1A1A]' : 'border-[#333333] hover:border-[#666666] hover:bg-[#161616]'}
                    focus-within:ring-2 focus-within:ring-[#EDEDED] focus-within:ring-offset-2 focus-within:ring-offset-[#111111]
                  `}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="video/*"
                    className="sr-only"
                  />
                  <div className="p-4 bg-[#1A1A1A] rounded-full mb-4 group-hover:scale-110 transition-transform duration-500 ease-out">
                    <UploadCloud className="w-6 h-6 text-[#888888] group-hover:text-[#EDEDED] transition-colors duration-500" />
                  </div>
                  <p className="text-sm font-medium mb-1">Click or drag video to upload</p>
                  <p className="text-xs text-[#666666]">MP4, MOV, WEBM up to 2GB</p>
                </div>
              </motion.div>
            ) : !outputUrl ? (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                {/* File Info */}
                <div className="flex items-center justify-between p-4 bg-[#1A1A1A] rounded-xl border border-[#222222]">
                  <div className="flex items-center space-x-4 overflow-hidden">
                    <div className="p-2 bg-[#222222] rounded-lg shrink-0">
                      <FileAudio className="w-5 h-5 text-[#EDEDED]" />
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-[#666666]">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  {!isProcessing && (
                    <button 
                      onClick={reset}
                      className="text-xs text-[#888888] hover:text-[#EDEDED] transition-colors duration-300 px-3 py-1.5 rounded-md hover:bg-[#222222]"
                    >
                      Change
                    </button>
                  )}
                </div>

                {/* Format Selection */}
                <div className="space-y-3">
                  <label className="text-xs font-medium text-[#888888] uppercase tracking-wider">Output Format</label>
                  <div className="flex p-1 bg-[#1A1A1A] rounded-lg border border-[#222222] relative">
                    {(['mp3', 'wav', 'aac'] as Format[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => !isProcessing && setFormat(f)}
                        disabled={isProcessing}
                        className={`
                          flex-1 py-2 text-sm font-medium rounded-md transition-all duration-500 relative z-10
                          ${format === f ? 'text-[#000000]' : 'text-[#888888] hover:text-[#EDEDED]'}
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EDEDED] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1A1A]
                        `}
                      >
                        {f.toUpperCase()}
                        {format === f && (
                          <motion.div
                            layoutId="activeTab"
                            className="absolute inset-0 bg-[#EDEDED] rounded-md -z-10"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action / Progress */}
                <div className="pt-4">
                  {isProcessing ? (
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-[#888888] flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Processing...
                        </span>
                        <span className="text-[#EDEDED]">{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-[#EDEDED]"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.1 }}
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={convertFile}
                      disabled={!isLoaded}
                      className="w-full py-3 px-4 bg-[#EDEDED] text-[#000000] text-sm font-medium rounded-xl hover:bg-white transition-all duration-500 focus:outline-none focus:ring-2 focus:ring-[#EDEDED] focus:ring-offset-2 focus:ring-offset-[#111111] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {!isLoaded ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Initializing Engine...
                        </>
                      ) : (
                        'Convert to Audio'
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex flex-col items-center text-center space-y-6 py-8"
              >
                <div className="w-16 h-16 bg-[#1A1A1A] rounded-full flex items-center justify-center border border-[#222222]">
                  <CheckCircle2 className="w-8 h-8 text-[#EDEDED]" />
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-lg font-medium">Ready for Download</h3>
                  <p className="text-sm text-[#888888]">
                    output.{format} • {outputSize}
                  </p>
                </div>

                <div className="flex w-full gap-3 pt-4">
                  <button
                    onClick={reset}
                    className="flex-1 py-3 px-4 bg-[#1A1A1A] text-[#EDEDED] border border-[#333333] text-sm font-medium rounded-xl hover:bg-[#222222] hover:border-[#444444] transition-all duration-500 focus:outline-none focus:ring-2 focus:ring-[#EDEDED] focus:ring-offset-2 focus:ring-offset-[#111111]"
                  >
                    Convert Another
                  </button>
                  <a
                    href={outputUrl}
                    download={`output.${format}`}
                    className="flex-1 py-3 px-4 bg-[#EDEDED] text-[#000000] text-sm font-medium rounded-xl hover:bg-white transition-all duration-500 focus:outline-none focus:ring-2 focus:ring-[#EDEDED] focus:ring-offset-2 focus:ring-offset-[#111111] flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-[#444444]">
            Powered by WebAssembly. Processed entirely in your browser.
          </p>
        </div>
      </div>
    </div>
  );
}
