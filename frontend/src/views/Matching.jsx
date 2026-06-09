import React, { useState, useEffect, useRef } from 'react';
import { FileText, ChevronRight, ChevronLeft, Crop, Check, HelpCircle, Image, RefreshCw, Upload } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Resolve worker path dynamically based on current page path for subdirectory hosting support
const getWorkerPath = () => {
  const pathParts = window.location.pathname.split('/');
  pathParts.pop(); // remove file name (e.g. index.html) if present
  const baseHref = window.location.origin + pathParts.join('/') + '/';
  return baseHref + 'pdf.worker.min.mjs';
};
pdfjsLib.GlobalWorkerOptions.workerSrc = getWorkerPath();

export default function Matching() {
  const [unlinkedList, setUnlinkedList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  
  // PDF States
  const [pdfFiles, setPdfFiles] = useState([]);
  const [selectedPdf, setSelectedPdf] = useState('');
  const [pdf, setPdf] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [isImage, setIsImage] = useState(false);
  const [loadedImage, setLoadedImage] = useState(null);
  
  // Cropping States
  const canvasRef = useRef(null);
  const [cropStart, setCropStart] = useState(null);
  const [cropEnd, setCropEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cropRect, setCropRect] = useState(null);
  const [pdfScale, setPdfScale] = useState(1.5);
  
  // Search unlinked names
  const [searchQuery, setSearchQuery] = useState('');

  // Sidebar filter & two-sided card states
  const [filterStatus, setFilterStatus] = useState('pending'); // 'pending' or 'all'
  const [cardMode, setCardMode] = useState('one-sided'); // 'one-sided' or 'two-sided'
  const [firstFaceBlob, setFirstFaceBlob] = useState(null);
  const [firstFacePreview, setFirstFacePreview] = useState('');
  const [processing, setProcessing] = useState(false);

  // Fetch unlinked beneficiaries
  const fetchUnlinked = async (status = filterStatus) => {
    setLoadingList(true);
    try {
      const url = status === 'pending'
        ? `${window.API_BASE_URL}/api/beneficiaries?card_status=pending`
        : `${window.API_BASE_URL}/api/beneficiaries`;
      const res = await fetch(url);
      const data = await res.json();
      setUnlinkedList(data);
      // Auto select first beneficiary if none selected
      if (data.length > 0 && !selectedBeneficiary) {
        setSelectedBeneficiary(data[0]);
      }
    } catch (error) {
      console.error("Failed to fetch beneficiary list", error);
    } finally {
      setLoadingList(false);
    }
  };

  // Fetch available PDF files
  const fetchPdfFiles = async () => {
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/pdfs`);
      const files = await res.json();
      setPdfFiles(files);
      if (files.length > 0 && !selectedPdf) {
        setSelectedPdf(files[0]);
      }
    } catch (error) {
      console.error("Failed to fetch PDF files", error);
    }
  };

  useEffect(() => {
    fetchUnlinked(filterStatus);
    fetchPdfFiles();
  }, [filterStatus]);

  // Global mouseup listener to fix dragging release bug
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // Load PDF or Image when selected file changes
  useEffect(() => {
    if (selectedPdf) {
      loadPdf(selectedPdf);
    } else {
      setPdf(null);
      setIsImage(false);
      setLoadedImage(null);
      setCurrentPage(1);
      setTotalPages(0);
    }
  }, [selectedPdf]);

  // Re-render page when currentPage, pdf, or loadedImage changes
  useEffect(() => {
    if (isImage && loadedImage) {
      renderImage();
    } else if (pdf) {
      renderPage(currentPage);
    }
  }, [currentPage, pdf, loadedImage, isImage]);

  // Helper to log messages to server console
  const logToServer = async (level, message, details = null) => {
    try {
      await fetch(`${window.API_BASE_URL}/api/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, message, details })
      });
    } catch (e) {
      console.error("Failed to send log to server", e);
    }
  };

  const loadPdf = async (filename) => {
    setLoadingPdf(true);
    setCropRect(null);
    setIsImage(false);
    setLoadedImage(null);
    logToServer('info', `Attempting to load file: "${filename}"`);

    const ext = filename.split('.').pop().toLowerCase();
    const isImgFile = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);

    if (isImgFile) {
      setIsImage(true);
      try {
        const url = `${window.API_BASE_URL}/api/pdfs/${encodeURIComponent(filename)}`;
        const img = new window.Image();
        img.crossOrigin = 'anonymous'; // Enable CORS just in case
        await new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = (e) => reject(new Error("Failed to load image file: " + e));
          img.src = url;
        });
        setLoadedImage(img);
        setTotalPages(1); // Images only have 1 page
        setCurrentPage(1);
      } catch (error) {
        console.error("Error loading image", error);
        alert("فشل تحميل ملف الصورة.");
      } finally {
        setLoadingPdf(false);
      }
    } else {
      try {
        const url = `${window.API_BASE_URL}/api/pdfs/${encodeURIComponent(filename)}`;
        logToServer('info', `Constructed PDF URL: "${url}"`);
        logToServer('info', `workerSrc configured as: "${pdfjsLib.GlobalWorkerOptions.workerSrc}"`);
        
        logToServer('info', `Calling pdfjsLib.getDocument({ url: url })...`);
        const loadingTask = pdfjsLib.getDocument({ url: url });
        logToServer('info', `getDocument task created successfully. Waiting for promise...`);
        
        const pdfDoc = await loadingTask.promise;
        logToServer('info', `PDF document loaded successfully. Total pages: ${pdfDoc.numPages}`);
        
        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);
        setCurrentPage(1);
      } catch (error) {
        logToServer('error', `Error loading PDF document: ${error.message || error}`, {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        console.error("Error loading PDF document", error);
        alert("فشل تحميل ملف الـ PDF. تأكد من سلامة الملف.");
      } finally {
        setLoadingPdf(false);
      }
    }
  };

  const renderImage = () => {
    if (!loadedImage) return;
    setCropRect(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const container = canvas.closest('.pdf-viewer-container');
    const containerWidth = container ? container.clientWidth - 48 : 600;

    const originalWidth = loadedImage.width;
    const scaleX = containerWidth / originalWidth;
    
    // Scale to fit width-wise (horizontally) just like PDFs
    const displayScale = scaleX * 0.97;
    
    canvas.width = originalWidth * displayScale;
    canvas.height = loadedImage.height * displayScale;
    setPdfScale(displayScale);

    ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);
  };

  const renderPage = async (pageNum) => {
    if (!pdf) return;
    setRendering(true);
    setCropRect(null);
    try {
      const page = await pdf.getPage(pageNum);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      const container = canvas.closest('.pdf-viewer-container');
      const containerWidth = container ? container.clientWidth - 48 : 600;
      
      const originalViewport = page.getViewport({ scale: 1 });
      const scaleX = containerWidth / originalViewport.width;
      
      // Scale to fit width-wise (horizontally) so cards are not too small.
      // We use scaleX * 0.97 to give a tiny margin and avoid horizontal scrollbars.
      const displayScale = scaleX * 0.97;
      const viewport = page.getViewport({ scale: displayScale });
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setPdfScale(displayScale);
      
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };
      await page.render(renderContext).promise;
    } catch (error) {
      console.error("Error rendering page", error);
    } finally {
      setRendering(false);
    }
  };

  // Switch pages for PDF or Switch files for images
  const prevPage = () => {
    if (isImage) {
      const currentIndex = pdfFiles.indexOf(selectedPdf);
      if (currentIndex > 0) {
        setSelectedPdf(pdfFiles[currentIndex - 1]);
      }
    } else {
      if (currentPage > 1) setCurrentPage(currentPage - 1);
    }
  };

  const nextPage = () => {
    if (isImage) {
      const currentIndex = pdfFiles.indexOf(selectedPdf);
      if (currentIndex < pdfFiles.length - 1) {
        setSelectedPdf(pdfFiles[currentIndex + 1]);
      }
    } else {
      if (currentPage < totalPages) setCurrentPage(currentPage + 1);
    }
  };

  // Crop overlay handlers
  const handleMouseDown = (e) => {
    if (rendering || (!pdf && !isImage)) return;
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCropStart({ x, y });
    setCropEnd({ x, y });
    setCropRect({ x, y, width: 0, height: 0 });
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !cropStart) return;
    const rect = e.target.getBoundingClientRect();
    
    // Bound coordinate dragging within canvas
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    
    setCropEnd({ x, y });
    
    const startX = cropStart.x;
    const startY = cropStart.y;
    const left = Math.min(startX, x);
    const top = Math.min(startY, y);
    const width = Math.abs(startX - x);
    const height = Math.abs(startY - y);
    
    setCropRect({ x: left, y: top, width, height });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Helper to crop page from high resolution offscreen canvas
  const getHighResCropCanvas = async (isFullPage = false, customCropRect = null) => {
    if (isImage) {
      if (!loadedImage) return null;
      try {
        const cropCanvas = document.createElement('canvas');
        const cropCtx = cropCanvas.getContext('2d');
        
        let sx = 0, sy = 0, sw = loadedImage.width, sh = loadedImage.height;
        if (!isFullPage) {
          const targetRect = customCropRect || cropRect;
          const ratio = 1.0 / pdfScale;
          sx = targetRect.x * ratio;
          sy = targetRect.y * ratio;
          sw = targetRect.width * ratio;
          sh = targetRect.height * ratio;
        }
        
        cropCanvas.width = sw;
        cropCanvas.height = sh;
        
        cropCtx.drawImage(
          loadedImage,
          sx, sy, sw, sh,
          0, 0, sw, sh
        );
        
        return cropCanvas;
      } catch (e) {
        console.error("Image crop failed", e);
        throw new Error("فشل اقتصاص الصورة: " + e.message);
      }
    }

    if (!pdf) return null;
    try {
      const page = await pdf.getPage(currentPage);
      
      // Use scale = 3.0 for high resolution print-ready outputs (approx 300 DPI)
      const highScale = 3.0;
      const viewport = page.getViewport({ scale: highScale });
      
      const offscreenCanvas = document.createElement('canvas');
      const offscreenCtx = offscreenCanvas.getContext('2d');
      offscreenCanvas.width = viewport.width;
      offscreenCanvas.height = viewport.height;
      
      const renderContext = {
        canvasContext: offscreenCtx,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      const cropCanvas = document.createElement('canvas');
      const cropCtx = cropCanvas.getContext('2d');
      
      let sx = 0, sy = 0, sw = offscreenCanvas.width, sh = offscreenCanvas.height;
      if (!isFullPage) {
        const targetRect = customCropRect || cropRect;
        const ratio = highScale / pdfScale;
        sx = targetRect.x * ratio;
        sy = targetRect.y * ratio;
        sw = targetRect.width * ratio;
        sh = targetRect.height * ratio;
      }
      
      cropCanvas.width = sw;
      cropCanvas.height = sh;
      
      cropCtx.drawImage(
        offscreenCanvas,
        sx, sy, sw, sh,
        0, 0, sw, sh
      );
      
      return cropCanvas;
    } catch (e) {
      console.error("High-res crop rendering failed", e);
      throw new Error("فشل معالجة المستند بدقة عالية: " + e.message);
    }
  };

  // Crop & upload selected canvas region
  const handleLinkAndCrop = async (isFullPage = false) => {
    if (!selectedBeneficiary) {
      alert("الرجاء تحديد اسم مستفيد من القائمة اليسرى.");
      return;
    }
    if (!pdf && !isImage) {
      alert("الرجاء تحميل ملف PDF أو صورة تحتوي على البطاقة أولاً.");
      return;
    }
    if (!isFullPage && (!cropRect || cropRect.width < 15 || cropRect.height < 15)) {
      alert("الرجاء رسم مربع تحديد حول البطاقة أولاً (اضغط واسحب بالماوس).");
      return;
    }

    setProcessing(true);
    try {
      const cropCanvas = await getHighResCropCanvas(isFullPage);
      if (!cropCanvas) {
        alert("فشل معالجة الصورة عالية الدقة.");
        setProcessing(false);
        return;
      }

      cropCanvas.toBlob(async (blob) => {
        if (!blob) {
          alert("فشل تكوين ملف الصورة.");
          setProcessing(false);
          return;
        }
        
        const formData = new FormData();
        formData.append('beneficiaryId', selectedBeneficiary.id);
        formData.append('image', blob, 'cropped_card.jpg');

        const res = await fetch(`${window.API_BASE_URL}/api/link-card`, {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          setCropRect(null);
          setCropStart(null);
          setCropEnd(null);
          
          const currentIndex = unlinkedList.findIndex(b => b.id === selectedBeneficiary.id);
          const url = filterStatus === 'pending'
            ? `${window.API_BASE_URL}/api/beneficiaries?card_status=pending`
            : `${window.API_BASE_URL}/api/beneficiaries`;
          const qRes = await fetch(url);
          const freshList = await qRes.json();
          setUnlinkedList(freshList);
          
          if (filterStatus === 'pending') {
            if (freshList.length > 0) {
              const nextIndex = currentIndex < freshList.length ? currentIndex : 0;
              setSelectedBeneficiary(freshList[nextIndex]);
            } else {
              setSelectedBeneficiary(null);
            }
          } else {
            const updated = freshList.find(b => b.id === selectedBeneficiary.id);
            if (updated) setSelectedBeneficiary(updated);
          }
        } else {
          const errText = await res.text();
          console.error("Server error linking card:", errText);
          alert("حدث خطأ أثناء ربط الصورة: " + errText);
        }
        setProcessing(false);
      }, 'image/jpeg', 0.95);

    } catch (error) {
      console.error("Error cropping canvas", error);
      alert("فشل اقتصاص الصورة: " + error.message);
      setProcessing(false);
    }
  };

  const handleSaveFirstFace = async (isFullPage = false) => {
    if (!pdf && !isImage) {
      alert("الرجاء تحميل ملف PDF أو صورة أولاً.");
      return;
    }
    if (!isFullPage && (!cropRect || cropRect.width < 15 || cropRect.height < 15)) {
      alert("الرجاء رسم مربع تحديد حول الوجه الأول أولاً (اضغط واسحب بالماوس).");
      return;
    }

    setProcessing(true);
    try {
      const cropCanvas = await getHighResCropCanvas(isFullPage);
      if (!cropCanvas) {
        alert("فشل اقتصاص الوجه الأول بدقة عالية.");
        setProcessing(false);
        return;
      }

      cropCanvas.toBlob((blob) => {
        if (!blob) {
          alert("فشل تحويل الوجه الأول إلى ملف.");
          setProcessing(false);
          return;
        }
        setFirstFaceBlob(blob);
        setFirstFacePreview(cropCanvas.toDataURL('image/jpeg', 0.95));
        
        setCropRect(null);
        setCropStart(null);
        setCropEnd(null);
        setProcessing(false);
      }, 'image/jpeg', 0.95);

    } catch (error) {
      console.error("Error saving first face", error);
      alert("فشل حفظ الوجه الأول: " + error.message);
      setProcessing(false);
    }
  };

  const handleMergeAndLink = async (isFullPage = false) => {
    if (!selectedBeneficiary) {
      alert("الرجاء تحديد اسم مستفيد من القائمة اليسرى.");
      return;
    }
    if (!firstFaceBlob) {
      alert("لا يوجد وجه أول محفوظ للدمج معه.");
      return;
    }
    if (!pdf && !isImage) {
      alert("الرجاء تحميل ملف PDF أو صورة أولاً.");
      return;
    }
    if (!isFullPage && (!cropRect || cropRect.width < 15 || cropRect.height < 15)) {
      alert("الرجاء رسم مربع تحديد حول الوجه الثاني أولاً (اضغط واسحب بالماوس).");
      return;
    }

    setProcessing(true);
    try {
      const secondCanvas = await getHighResCropCanvas(isFullPage);
      if (!secondCanvas) {
        alert("فشل اقتصاص الوجه الثاني بدقة عالية.");
        setProcessing(false);
        return;
      }

      const firstImg = new window.Image();
      const objectUrl = URL.createObjectURL(firstFaceBlob);
      await new Promise((resolve, reject) => {
        firstImg.onload = () => resolve();
        firstImg.onerror = (e) => reject(new Error("Failed to load first face image: " + e));
        firstImg.src = objectUrl;
      });

      const mergeCanvas = document.createElement('canvas');
      const mergeCtx = mergeCanvas.getContext('2d');
      
      const combinedWidth = Math.max(firstImg.width, secondCanvas.width);
      const combinedHeight = firstImg.height + secondCanvas.height + 15; // 15px gap
      
      mergeCanvas.width = combinedWidth;
      mergeCanvas.height = combinedHeight;
      
      mergeCtx.fillStyle = '#ffffff';
      mergeCtx.fillRect(0, 0, combinedWidth, combinedHeight);
      
      const x1 = (combinedWidth - firstImg.width) / 2;
      mergeCtx.drawImage(firstImg, x1, 0);
      
      mergeCtx.strokeStyle = '#cbd5e1';
      mergeCtx.lineWidth = 2;
      mergeCtx.setLineDash([6, 6]);
      mergeCtx.beginPath();
      mergeCtx.moveTo(10, firstImg.height + 7);
      mergeCtx.lineTo(combinedWidth - 10, firstImg.height + 7);
      mergeCtx.stroke();
      
      const x2 = (combinedWidth - secondCanvas.width) / 2;
      mergeCtx.drawImage(secondCanvas, x2, firstImg.height + 15);

      mergeCanvas.toBlob(async (blob) => {
        if (!blob) {
          alert("فشل إنشاء ملف الصورة المدمجة.");
          setProcessing(false);
          return;
        }
        
        const formData = new FormData();
        formData.append('beneficiaryId', selectedBeneficiary.id);
        formData.append('image', blob, 'merged_card.jpg');

        const res = await fetch(`${window.API_BASE_URL}/api/link-card`, {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          setFirstFaceBlob(null);
          setFirstFacePreview('');
          setCropRect(null);
          setCropStart(null);
          setCropEnd(null);
          
          const currentIndex = unlinkedList.findIndex(b => b.id === selectedBeneficiary.id);
          const url = filterStatus === 'pending'
            ? `${window.API_BASE_URL}/api/beneficiaries?card_status=pending`
            : `${window.API_BASE_URL}/api/beneficiaries`;
          const qRes = await fetch(url);
          const freshList = await qRes.json();
          setUnlinkedList(freshList);
          
          if (filterStatus === 'pending') {
            if (freshList.length > 0) {
              const nextIndex = currentIndex < freshList.length ? currentIndex : 0;
              setSelectedBeneficiary(freshList[nextIndex]);
            } else {
              setSelectedBeneficiary(null);
            }
          } else {
            const updated = freshList.find(b => b.id === selectedBeneficiary.id);
            if (updated) setSelectedBeneficiary(updated);
          }
        } else {
          const errText = await res.text();
          console.error("Server error linking merged card:", errText);
          alert("حدث خطأ أثناء ربط الصورة المدمجة: " + errText);
        }
        
        URL.revokeObjectURL(objectUrl);
        setProcessing(false);
      }, 'image/jpeg', 0.95);

    } catch (error) {
      console.error("Error merging and linking", error);
      alert("فشل دمج وجهي البطاقة: " + error.message);
      setProcessing(false);
    }
  };

  // Filter list by search query
  const filteredList = unlinkedList.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (b.phone && b.phone.includes(searchQuery)) ||
    (b.id_number && b.id_number.includes(searchQuery))
  );

  // Upload custom PDF directly from UI
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/pdfs/upload`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        await fetchPdfFiles();
        setSelectedPdf(data.filename);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="matching-layout">
      {/* Left List of Beneficiaries */}
      <div className="matching-sidebar">
        <div className="matching-list-header">
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button 
              className={`btn ${filterStatus === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
              onClick={() => {
                setFilterStatus('pending');
                setSelectedBeneficiary(null);
                setFirstFaceBlob(null);
                setFirstFacePreview('');
              }}
            >
              غير مربوطين
            </button>
            <button 
              className={`btn ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
              onClick={() => {
                setFilterStatus('all');
                setSelectedBeneficiary(null);
                setFirstFaceBlob(null);
                setFirstFacePreview('');
              }}
            >
              الجميع
            </button>
          </div>
          <input 
            type="text" 
            className="form-control" 
            placeholder={filterStatus === 'pending' ? "بحث في القائمة المعلقة..." : "بحث في جميع المستفيدين..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="matching-list-items">
          {loadingList ? (
            <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>جاري تحميل القائمة...</p>
          ) : filteredList.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>لا توجد أسماء مطابقة للبحث.</p>
          ) : (
            filteredList.map(item => (
              <div 
                key={item.id} 
                className={`matching-name-card ${selectedBeneficiary?.id === item.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedBeneficiary(item);
                  // Reset temporary first face if we switch beneficiaries
                  if (selectedBeneficiary?.id !== item.id) {
                    setFirstFaceBlob(null);
                    setFirstFacePreview('');
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <h5 style={{ margin: 0, fontWeight: 700 }}>{item.name}</h5>
                  <span className={`badge badge-${item.card_status === 'linked' ? 'linked' : 'pending'}`}>
                    {item.card_status === 'linked' ? 'مربوط' : 'معلق'}
                  </span>
                </div>
                <p style={{ margin: '2px 0' }}>الهاتف: {item.phone || '—'} | الهوية: {item.id_number || '—'}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '6px', color: 'var(--text-muted)' }}>
                  <span>المنطقة: {item.region || '—'}</span>
                  <span>المندوب: {item.delegate_name || '—'}</span>
                </div>
                
                {selectedBeneficiary?.id === item.id && item.card_image_path && (
                  <div style={{ marginTop: '12px', borderTop: '1px dashed var(--border-color)', paddingTop: '12px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-primary)' }}>البطاقة الحالية المرتبطة:</p>
                    <img 
                      src={`${window.API_BASE_URL}${item.card_image_path}?t=${new Date().getTime()}`} 
                      alt="البطاقة الحالية" 
                      style={{ 
                        width: '100%', 
                        borderRadius: '6px', 
                        border: '1px solid var(--border-color)', 
                        maxHeight: '130px', 
                        objectFit: 'contain',
                        backgroundColor: 'var(--bg-tertiary)'
                      }} 
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right PDF Preview and Crop View */}
      <div className="matching-viewer">
        {/* PDF selection bar */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <FileText size={18} style={{ color: 'var(--primary)' }} />
            <select 
              className="filter-select" 
              style={{ flex: 1, minWidth: '200px' }}
              value={selectedPdf} 
              onChange={(e) => setSelectedPdf(e.target.value)}
            >
              <option value="">اختر ملف PDF أو صورة للبطاقات...</option>
              {pdfFiles.map(file => <option key={file} value={file}>{file}</option>)}
            </select>
            <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={fetchPdfFiles} title="تحديث قائمة الملفات">
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Upload directly */}
          <label className="btn btn-secondary" style={{ margin: 0, display: 'inline-flex', cursor: 'pointer' }}>
            <Upload size={16} />
            رفع ملف جديد
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={handlePdfUpload} />
          </label>

          {/* Page/File navigation */}
          {(pdf || isImage) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '8px' }} 
                onClick={prevPage} 
                disabled={isImage ? pdfFiles.indexOf(selectedPdf) <= 0 : currentPage === 1}
              >
                <ChevronRight size={18} />
              </button>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                {isImage ? `ملف ${pdfFiles.indexOf(selectedPdf) + 1} من ${pdfFiles.length}` : `الصفحة ${currentPage} من ${totalPages}`}
              </span>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '8px' }} 
                onClick={nextPage} 
                disabled={isImage ? (pdfFiles.indexOf(selectedPdf) === -1 || pdfFiles.indexOf(selectedPdf) >= pdfFiles.length - 1) : currentPage === totalPages}
              >
                <ChevronLeft size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Canvas Display Viewport */}
        <div className="pdf-viewer-container">
          {loadingPdf ? (
            <div style={{ color: '#ffffff', textAlign: 'center', padding: '100px 0' }}>
              <RefreshCw size={40} className="spin" style={{ marginBottom: '16px' }} />
              <p>جاري تحميل وقراءة الملف...</p>
            </div>
          ) : !selectedPdf ? (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '100px 40px', maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <HelpCircle size={48} style={{ marginBottom: '16px', color: 'var(--primary)' }} />
              <h4 style={{ color: '#ffffff', fontWeight: 700, marginBottom: '8px' }}>مستند البطائق غير مفتوح</h4>
              <p style={{ lineHeight: '1.6', fontSize: '0.9rem' }}>
                الرجاء اختيار ملف PDF أو صورة من القائمة العلوية. سيتم عرض الملف هنا، حيث يمكنك تحديد وقص جزء منه لربطه فوراً بالاسم المحدد في القائمة الجانبية.
              </p>
            </div>
          ) : (
            <div className="pdf-canvas-wrapper">
              <canvas ref={canvasRef} style={{ display: 'block' }} />
              
              {/* Overlay division for mouse selection */}
              <div 
                className="crop-overlay" 
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              />
              
              {/* Highlight selector rectangle */}
              {cropRect && (
                <div 
                  className="crop-rectangle"
                  style={{
                    left: `${cropRect.x}px`,
                    top: `${cropRect.y}px`,
                    width: `${cropRect.width}px`,
                    height: `${cropRect.height}px`
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Action Matching bar */}
        {selectedBeneficiary && (pdf || (isImage && loadedImage)) && (
          <div className="matching-controls" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', fontSize: '0.85rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
            
            {/* Beneficiary Name & Mode Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>المستفيد:</span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--primary)' }}>{selectedBeneficiary.name}</strong>
              </div>

              {/* Shrunk Mode Selector */}
              <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
                <button
                  className="btn"
                  disabled={processing}
                  style={{ 
                    padding: '4px 10px', 
                    fontSize: '0.75rem', 
                    background: cardMode === 'one-sided' ? 'var(--primary)' : 'transparent',
                    color: cardMode === 'one-sided' ? '#ffffff' : 'var(--text-primary)',
                    boxShadow: cardMode === 'one-sided' ? 'var(--shadow-sm)' : 'none',
                    borderRadius: 'var(--radius-sm)',
                    minHeight: 'auto'
                  }}
                  onClick={() => {
                    setCardMode('one-sided');
                    setFirstFaceBlob(null);
                    setFirstFacePreview('');
                  }}
                >
                  وجه واحد
                </button>
                <button
                  className="btn"
                  disabled={processing}
                  style={{ 
                    padding: '4px 10px', 
                    fontSize: '0.75rem', 
                    background: cardMode === 'two-sided' ? 'var(--primary)' : 'transparent',
                    color: cardMode === 'two-sided' ? '#ffffff' : 'var(--text-primary)',
                    boxShadow: cardMode === 'two-sided' ? 'var(--shadow-sm)' : 'none',
                    borderRadius: 'var(--radius-sm)',
                    minHeight: 'auto'
                  }}
                  onClick={() => setCardMode('two-sided')}
                >
                  وجهين
                </button>
              </div>
            </div>

            {/* Actions for each mode */}
            {cardMode === 'one-sided' ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  onClick={() => handleLinkAndCrop(true)}
                  disabled={processing}
                  title={isImage ? "ربط الصورة المعروضة بالكامل بدون اقتصاص" : "ربط الصفحة المعروضة بالكامل بدون اقتصاص"}
                >
                  <Image size={14} />
                  {processing ? "جاري الربط..." : (isImage ? "ربط الصورة كاملة" : "ربط الصفحة كاملة")}
                </button>

                <button 
                  className="btn btn-primary" 
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  onClick={() => handleLinkAndCrop(false)}
                  disabled={processing || !cropRect || cropRect.width < 10}
                  title="قص الجزء المحدد فقط وربطه"
                >
                  <Crop size={14} />
                  {processing ? "جاري القص..." : "قص التحديد وربطه"}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {firstFacePreview && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>الوجه الأول جاهز</span>
                    <img 
                      src={firstFacePreview} 
                      alt="الوجه الأول" 
                      style={{ height: '24px', borderRadius: '2px', border: '1px solid var(--border-color)', objectFit: 'contain', backgroundColor: '#ffffff' }}
                    />
                    <button 
                      className="btn btn-danger" 
                      disabled={processing}
                      style={{ padding: '2px 6px', fontSize: '0.7rem', borderRadius: 'var(--radius-sm)', minHeight: 'auto' }}
                      onClick={() => {
                        setFirstFaceBlob(null);
                        setFirstFacePreview('');
                      }}
                    >
                      إلغاء
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  {!firstFaceBlob ? (
                    <>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => handleSaveFirstFace(true)}
                        disabled={processing}
                        title={isImage ? "حفظ الصورة كاملة كوجه أول" : "حفظ الصفحة كاملة كوجه أول"}
                      >
                        <Image size={14} />
                        {processing ? "جاري الحفظ..." : (isImage ? "الصورة كوجه أول" : "الصفحة كوجه أول")}
                      </button>

                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => handleSaveFirstFace(false)}
                        disabled={processing || !cropRect || cropRect.width < 10}
                        title="حفظ الجزء المحدد كوجه أول"
                      >
                        <Crop size={14} />
                        {processing ? "جاري الحفظ..." : "التحديد كوجه أول"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => handleMergeAndLink(true)}
                        disabled={processing}
                        title={isImage ? "دمج الوجه الأول المحفوظ مع الصورة كاملة الحالية كوجه ثانٍ" : "دمج الوجه الأول المحفوظ مع الصفحة كاملة الحالية كوجه ثانٍ"}
                      >
                        <Image size={14} />
                        {processing ? "جاري الدمج..." : (isImage ? "دمج الصورة كاملة" : "دمج الصفحة كاملة")}
                      </button>

                      <button 
                        className="btn btn-success" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => handleMergeAndLink(false)}
                        disabled={processing || !cropRect || cropRect.width < 10}
                        title="دمج الوجه الأول المحفوظ مع التحديد الحالي كوجه ثانٍ"
                      >
                        <Crop size={14} />
                        {processing ? "جاري الدمج..." : "دمج التحديد وربط"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
