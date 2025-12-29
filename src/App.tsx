import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Download, FileText, Sparkles, RefreshCcw, FileCode, Type, Loader2, ChevronDown, Printer, FileInput, BookOpen, Check, Columns, Monitor, ZoomIn, PenTool, Grid, ScanLine, HelpCircle as CircleHelp, X, Phone, User, GraduationCap, RotateCcw, Coffee } from 'lucide-react';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { parseContent, generateWordCompatibleFile } from './utils/converter';
import { MathPreview } from './components/MathPreview';
import { GeminiChat } from './components/GeminiChat';
import { analyzeImagesToLatex } from './services/gemini';
import { ExportStyle } from './types';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

export default function App() {
  const [rawText, setRawText] = useState<string>(
    "Here is an example of an inline equation: $E=mc^2$.\n\nAnd here is a display equation:\n$$ \\int_{0}^{\\infty} x^2 e^{-x} dx = 2 $$\n\nPaste your LaTeX content here or upload a Word, PDF, or Image file to begin conversion."
  );
  const [fileName, setFileName] = useState("document");
  const [isImporting, setIsImporting] = useState(false);
  const [isRichText, setIsRichText] = useState(false);
  const [importStatus, setImportStatus] = useState<string>("");
  const [useSmartOCR, setUseSmartOCR] = useState(true); // Toggle for Smart AI OCR
  
  // UI States
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
        if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
            setIsExportMenuOpen(false);
        }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Computed state for parsed content
  const segments = parseContent(rawText);

  // Helper to read file as Base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Remove data url prefix (e.g. "data:image/png;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
  };

  // Helper to convert PDF pages to Base64 Images for AI Analysis
  const convertPdfToImages = async (arrayBuffer: ArrayBuffer, maxPages = 5): Promise<{ mimeType: string, data: string }[]> => {
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const images: { mimeType: string, data: string }[] = [];
      const numPages = Math.min(pdf.numPages, maxPages);

      for (let i = 1; i <= numPages; i++) {
          setImportStatus(`Rendering PDF Page ${i}/${numPages}...`);
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 }); // 1.5 scale is good balance for OCR
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
              await page.render({ canvasContext: context, viewport: viewport } as any).promise;
              const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
              images.push({ mimeType: 'image/jpeg', data: base64Data });
          }
      }
      return images;
  };

  const extractTextFromPDF = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `## Page ${i}\n\n${pageText}\n\n`;
    }
    return fullText;
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus("Reading file...");
    setFileName(file.name.replace(/\.[^/.]+$/, ""));

    try {
        const extension = file.name.split('.').pop()?.toLowerCase();

        if (extension === 'docx') {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            setRawText(result.value);
            setIsRichText(true);
            setImportStatus("");
        } 
        else if (extension === 'pdf') {
            const arrayBuffer = await file.arrayBuffer();
            if (useSmartOCR) {
                setImportStatus("Preparing Smart OCR...");
                const images = await convertPdfToImages(arrayBuffer);
                setImportStatus("Gemini AI is analyzing math formulas...");
                const transcribedText = await analyzeImagesToLatex(images);
                setRawText(transcribedText);
                setIsRichText(false);
            } else {
                setImportStatus("Extracting raw text...");
                const text = await extractTextFromPDF(arrayBuffer);
                setRawText(text);
                setIsRichText(false);
            }
            setImportStatus("");
        }
        else if (['jpg', 'jpeg', 'png', 'webp'].includes(extension || '')) {
            setImportStatus("Analyzing image with Gemini AI...");
            const base64 = await readFileAsBase64(file);
            const mimeType = file.type;
            const transcribedText = await analyzeImagesToLatex([{ mimeType, data: base64 }]);
            setRawText(transcribedText);
            setIsRichText(false);
            setImportStatus("");
        }
        else if (extension === 'doc') {
             setImportStatus("Processing .doc file...");
             try {
                const arrayBuffer = await file.arrayBuffer();
                try {
                    const result = await mammoth.convertToHtml({ arrayBuffer });
                    if (result.value) {
                        setRawText(result.value);
                        setIsRichText(true);
                        setImportStatus("");
                        return;
                    }
                } catch (e) { }
                const text = await file.text();
                if (text.charCodeAt(0) === 65533 || text.includes('\0')) {
                    throw new Error("Binary");
                }
                setRawText(text);
                setIsRichText(false);
                setImportStatus("");
             } catch (e) {
                 alert("File .doc này là định dạng cũ (Word 97-2003) chưa được hỗ trợ trên trình duyệt. \n\nVui lòng mở file bằng Word -> Chọn 'Save As' -> Chọn '.docx' và thử lại.");
                 setImportStatus("Error: Binary .doc");
             }
        }
    } catch (error) {
        console.error("Error reading file", error);
        alert(`Lỗi: ${error instanceof Error ? error.message : "Unknown error"}`);
        setImportStatus("Error");
    } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [useSmartOCR]);

  const handleReset = useCallback(() => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ nội dung và làm mới không?")) {
        setRawText("");
        setFileName("document");
        setIsRichText(false);
        setImportStatus("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const handleExport = useCallback(async (style: ExportStyle) => {
    const blob = await generateWordCompatibleFile(segments, isRichText, style);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    let suffix = "_" + style;
    link.download = `${fileName}${suffix}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExportMenuOpen(false);
  }, [segments, fileName, isRichText]);

  const ExportButton = ({ style, icon: Icon, title, sub, colorClass }: any) => (
      <button onClick={() => handleExport(style)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg text-left group">
        <div className={`p-2 rounded-md transition-colors ${colorClass}`}>
            <Icon size={16} />
        </div>
        <div>
            <div className="text-sm font-medium text-slate-800">{title}</div>
            <div className="text-xs text-slate-500">{sub}</div>
        </div>
      </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
                <div className="bg-brand-600 p-2 rounded-lg text-white"><Sparkles size={20} /></div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight whitespace-nowrap">
                MathDoc <span className="text-brand-600 font-light">AI</span>
                </h1>
            </div>
            <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-slate-200 h-8">
                <div className="flex flex-col justify-center text-[11px] leading-tight font-medium text-slate-500">
                    <span className="text-brand-700 font-bold">Thầy Vũ Tiến Lực</span>
                    <span>Trường THPT Nguyễn Hữu Cảnh -TP Hồ Chí Minh- 0969069949</span>
                </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsHelpOpen(true)} className="text-slate-500 hover:text-brand-600 transition-colors p-2 hover:bg-slate-100 rounded-full">
                <CircleHelp size={22} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 gap-6 grid grid-cols-1 lg:grid-cols-2 h-[calc(100vh-6.5rem)]">
        <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/50">
            <div className="flex justify-between items-center">
                <h2 className="font-semibold text-slate-700 flex items-center gap-2"><FileText size={18} /> Nguồn nhập liệu</h2>
                <div className="flex gap-2">
                    <button onClick={handleReset} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium border bg-white text-slate-600 border-slate-200 hover:bg-red-50 hover:text-red-600 transition-colors"><RotateCcw size={14} /> Làm mới</button>
                    <button onClick={() => setUseSmartOCR(!useSmartOCR)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${useSmartOCR ? "bg-brand-50 text-brand-700 border-brand-200 shadow-sm" : "bg-slate-100 text-slate-500"}`}><ScanLine size={14} />{useSmartOCR ? "Smart OCR" : "Legacy"}</button>
                    <button onClick={() => setIsRichText(!isRichText)} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors ${isRichText ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>{isRichText ? <FileCode size={12}/> : <Type size={12}/>}{isRichText ? "HTML" : "Text"}</button>
                </div>
            </div>
            <label className="w-full cursor-pointer flex items-center justify-center gap-2 px-3 py-3 bg-white border border-dashed border-slate-300 rounded-lg hover:border-brand-400 hover:bg-brand-50/10 transition-all text-sm font-medium text-slate-600">
                <Upload size={16} className="text-brand-600" /><span>Tải lên PDF, Word, hoặc Ảnh</span>
                <input type="file" accept=".docx,.doc,.pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFileUpload} disabled={isImporting} ref={fileInputRef} />
            </label>
          </div>
          <div className="flex-1 relative">
            <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} className={`absolute inset-0 w-full h-full p-4 resize-none focus:outline-none font-mono text-sm leading-relaxed ${isRichText ? 'text-purple-800 bg-purple-50/10' : ''}`} spellCheck={false} />
            {isImporting && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-20 text-center">
                    <Loader2 className="animate-spin text-brand-600 mb-3" size={40} />
                    <p className="text-lg font-semibold text-slate-800 mb-1">Đang xử lý tập tin</p>
                    <p className="text-sm text-slate-500 max-w-xs">{importStatus}</p>
                </div>
            )}
          </div>
        </div>

        <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2"><RefreshCcw size={18} className="text-slate-400" /> Xem trước</h2>
            <div className="relative" ref={exportMenuRef}>
                <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="flex items-center gap-2 px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm transition-all text-sm font-medium"><Download size={14} /> Xuất file Word <ChevronDown size={14} className={isExportMenuOpen ? 'rotate-180' : ''} /></button>
                {isExportMenuOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-20 max-h-[80vh] overflow-y-auto">
                        <div className="p-2 space-y-1">
                            <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cơ bản</div>
                            <ExportButton style="standard" icon={FileText} title="Xuất thông minh" sub="Giữ nguyên định dạng chuẩn" colorClass="bg-blue-50 text-blue-600" />
                            <ExportButton style="minimal" icon={Printer} title="Tối giản in ấn" sub="Đen trắng, tiết kiệm giấy" colorClass="bg-slate-100 text-slate-600" />
                            <div className="px-3 py-1 mt-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Học tập</div>
                            <ExportButton style="two-column" icon={Columns} title="Đề thi 2 cột" sub="Form đề thi tiêu chuẩn" colorClass="bg-indigo-50 text-indigo-600" />
                            <ExportButton style="worksheet" icon={FileInput} title="Phiếu bài tập" sub="Thêm dòng kẻ trả lời" colorClass="bg-green-50 text-green-600" />
                            <ExportButton style="flashcards" icon={Grid} title="Thẻ học tập" sub="Khung thẻ để cắt rời" colorClass="bg-pink-50 text-pink-600" />
                        </div>
                    </div>
                )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-white custom-scrollbar"><MathPreview segments={segments} isRichText={isRichText} /></div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-2.5 text-center text-sm text-slate-500 z-10">
        <div className="flex items-center justify-center gap-6">
            <span className="font-semibold text-brand-700 flex items-center gap-2"><User size={16}/> Tác giả: Vũ Tiến Lực</span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <a href="tel:0969068849" className="flex items-center gap-2 hover:text-brand-600 transition-colors font-medium"><Phone size={16}/> 0969068849</a>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="flex items-center gap-2 text-slate-500"><GraduationCap size={16}/> GV Trường THPT Nguyễn Hữu Cảnh</span>
        </div>
      </footer>
      <GeminiChat />

      {isHelpOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-brand-50">
                    <h3 className="text-xl font-bold text-brand-800 flex items-center gap-2"><CircleHelp className="text-brand-600" /> Hướng dẫn sử dụng</h3>
                    <button onClick={() => setIsHelpOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-500"><X size={20} /></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Donation Section MOVED TO TOP */}
                    <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm mb-4">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4"><Coffee size={24} /></div>
                            <h4 className="font-bold text-amber-900 text-lg mb-2">Mời tác giả 1 ly cafe!</h4>
                            <p className="text-amber-800 text-sm mb-6 leading-relaxed font-medium">
                                Nếu thấy app có ích, hãy mời tác giả 1 ly cafe nhé! Sự ủng hộ của bạn là động lực để tôi duy trì và phát triển thêm các tính năng mới. Trân trọng!
                            </p>
                            <div className="bg-white p-5 rounded-2xl shadow-md border border-amber-100 w-full max-w-[280px]">
                                <div className="mb-4 bg-brand-50 py-2 rounded-lg border border-brand-100">
                                    <div className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-1">Ngân hàng</div>
                                    <div className="text-lg font-black text-slate-800">AGRIBANK</div>
                                </div>
                                <img src={`https://img.vietqr.io/image/agribank-0969068849-compact2.png?amount=0&addInfo=Moi%20cafe%20MathDoc%20AI&accountName=VU%20TIEN%20LUC`} alt="QR Agribank Vũ Tiến Lực" className="w-48 h-48 mx-auto mb-4 border border-slate-50 rounded-lg p-1" />
                                <div className="pt-3 border-t border-slate-100 text-center">
                                    <div className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-tighter">Chủ tài khoản</div>
                                    <div className="font-bold text-slate-800 text-base mb-1 uppercase">Vũ Tiến Lực</div>
                                    <div className="inline-block px-3 py-1 bg-amber-100 text-amber-800 rounded-full font-mono text-sm font-bold">0969 068 849</div>
                                </div>
                            </div>
                            <p className="mt-4 text-[11px] text-amber-700 italic font-medium">* Số điện thoại trên dùng làm số tài khoản Agribank</p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">1</div>
                        <div><h4 className="font-bold text-slate-800 mb-1">Nhập nội dung</h4><p className="text-slate-600 leading-relaxed text-sm">Gõ trực tiếp mã LaTeX hoặc Upload ảnh/PDF. Sử dụng <strong>Smart OCR</strong> để AI tự nhận diện công thức toán chính xác.</p></div>
                    </div>
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold shrink-0">2</div>
                        <div><h4 className="font-bold text-slate-800 mb-1">Chỉnh sửa & Xem trước</h4><p className="text-slate-600 leading-relaxed text-sm">Kiểm tra lỗi tại khung soạn thảo. Kết quả hiển thị tức thì tại khung bên phải giống như bản in thực tế.</p></div>
                    </div>
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold shrink-0">3</div>
                        <div><h4 className="font-bold text-slate-800 mb-1">Xuất file Word</h4><p className="text-slate-600 leading-relaxed text-sm">Chọn các mẫu (Đề thi, Phiếu bài tập...) để tải về file .docx với công thức toán có thể chỉnh sửa.</p></div>
                    </div>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">Ứng dụng được phát triển bởi Vũ Tiến Lực © 2025</div>
            </div>
        </div>
      )}
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #e2e8f0; border-radius: 20px; }`}</style>
    </div>
  );
}