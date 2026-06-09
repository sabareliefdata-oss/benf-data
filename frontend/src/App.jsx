import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Database as DbIcon, 
  Play, 
  FolderGit2, 
  Users2, 
  Sun, 
  Moon, 
  Upload, 
  X, 
  AlertTriangle, 
  Check, 
  Info,
  ChevronLeft,
  RefreshCw,
  Shield
} from 'lucide-react';

// Import views
import Dashboard from './views/Dashboard';
import Database from './views/Database';
import Matching from './views/Matching';
import Projects from './views/Projects';
import DataManagement from './views/DataManagement';
import Settings from './views/Settings';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState('light');
  
  // Auth & Splash States
  const [splash, setSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // System Custom Identity States
  const [systemName, setSystemName] = useState(localStorage.getItem('systemName') || 'بوابة المستفيدين والربط الذكي');
  const [sidebarTitle, setSidebarTitle] = useState(localStorage.getItem('sidebarTitle') || 'بوابة المستفيدين');

  // Dynamic Logo Component with Fallback to Users2
  const LogoImage = ({ imgSize = 44, iconSize = 24, style = {}, showWrapper = true }) => {
    const [imgErr, setImgErr] = useState(false);
    const hasCustomLogo = localStorage.getItem('logo_timestamp') !== null;
    const logoUrl = `/logo.png?t=${localStorage.getItem('logo_timestamp') || 'default'}`;

    if (imgErr || !hasCustomLogo) {
      if (showWrapper) {
        return (
          <div style={{ 
            backgroundColor: 'var(--primary-light)', 
            padding: '8px', 
            borderRadius: '10px', 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            ...style
          }}>
            <Users2 size={iconSize} style={{ color: 'var(--primary)' }} />
          </div>
        );
      } else {
        return <Users2 size={iconSize} style={{ color: 'var(--primary)', ...style }} />;
      }
    }

    return (
      <img 
        src={logoUrl} 
        alt="Logo" 
        style={{ 
          width: `${imgSize}px`, 
          height: `${imgSize}px`, 
          objectFit: 'contain', 
          ...style 
        }} 
        onError={() => setImgErr(true)} 
      />
    );
  };

  // Splash Screen timer (2 seconds)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Check for saved login session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        if (parsed.role === 'viewer') {
          setActiveTab('database');
        }
      } catch (e) {
        localStorage.removeItem('currentUser');
      }
    }
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginPassword.trim()) return;

    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPassword.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentUser(data.user);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        setLoginPassword('');
        if (data.user.role === 'viewer') {
          setActiveTab('database');
        } else {
          setActiveTab('dashboard');
        }
      } else {
        setLoginError(data.error || 'كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.');
      }
    } catch (err) {
      console.error(err);
      setLoginError('فشل الاتصال بالسيرفر لتسجيل الدخول.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في تسجيل الخروج؟')) {
      setCurrentUser(null);
      localStorage.removeItem('currentUser');
      setActiveTab('dashboard');
    }
  };
  
  // Excel Import Wizard States
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importAnalysis, setImportAnalysis] = useState(null);
  const [duplicateActions, setDuplicateActions] = useState({}); // { rowNum: 'skip' | 'update' | 'force' }
  const [importSuccess, setImportSuccess] = useState(null);
  const [triggerExcelUploadFlag, setTriggerExcelUploadFlag] = useState(false);

  // Initialize Theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Trigger Excel File Selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setExcelFile(file);
      analyzeExcelFile(file);
    }
  };

  // Step 1: Upload Excel and Analyze Duplicates
  const analyzeExcelFile = async (file) => {
    setImportLoading(true);
    setImportAnalysis(null);
    setImportSuccess(null);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/beneficiaries/import-analyze`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setImportAnalysis(data);
        
        // Initialize all duplicate actions to 'skip' by default
        const initialActions = {};
        data.duplicates.forEach(d => {
          initialActions[d.rowNum] = 'skip';
        });
        setDuplicateActions(initialActions);
      } else {
        alert("فشل تحليل ملف الإكسل. يرجى التأكد من تطابق الحقول.");
        setExcelFile(null);
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء الاتصال بالسيرفر.");
      setExcelFile(null);
    } finally {
      setImportLoading(false);
    }
  };

  // Step 2: Confirm Commit Import
  const handleConfirmImport = async () => {
    if (!importAnalysis) return;
    setImportLoading(true);

    const payload = {
      newItems: importAnalysis.newItems,
      duplicates: importAnalysis.duplicates.map(d => ({
        item: d.item,
        action: duplicateActions[d.rowNum],
        existingRecord: d.existingRecord
      }))
    };

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/beneficiaries/import-commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        setImportSuccess(result);
        setImportAnalysis(null);
        setExcelFile(null);
        setTriggerExcelUploadFlag(true); // Flag to reload database view
      } else {
        alert("فشل حفظ البيانات المستوردة.");
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء حفظ التغييرات.");
    } finally {
      setImportLoading(false);
    }
  };

  const handleActionChangeForDuplicate = (rowNum, action) => {
    setDuplicateActions(prev => ({
      ...prev,
      [rowNum]: action
    }));
  };

  const setGlobalAction = (action) => {
    if (!importAnalysis) return;
    const updated = {};
    importAnalysis.duplicates.forEach(d => {
      updated[d.rowNum] = action;
    });
    setDuplicateActions(updated);
  };

  const resetImport = () => {
    setIsImportOpen(false);
    setExcelFile(null);
    setImportAnalysis(null);
    setImportSuccess(null);
  };

  if (splash) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#0f172a',
        color: '#ffffff',
        fontFamily: 'Cairo, sans-serif'
      }}>
        <div style={{
          backgroundColor: localStorage.getItem('logo_timestamp') ? 'transparent' : 'rgba(59, 130, 246, 0.1)',
          padding: localStorage.getItem('logo_timestamp') ? '0' : '24px',
          borderRadius: '24px',
          border: localStorage.getItem('logo_timestamp') ? 'none' : '1px solid rgba(59, 130, 246, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          animation: 'pulse 2s infinite ease-in-out'
        }}>
          <LogoImage imgSize={120} iconSize={70} showWrapper={false} style={{ color: '#3b82f6' }} />
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '8px', color: '#f8fafc' }}>{systemName}</h1>
        <p style={{ fontSize: '1rem', color: '#94a3b8', marginBottom: '32px' }}>نظام إدارة البيانات والبطاقات وتوزيع المستحقات</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <RefreshCw size={22} className="spin" style={{ color: '#3b82f6' }} />
          <span style={{ fontSize: '0.95rem', color: '#94a3b8', fontWeight: 600 }}>جاري تهيئة النظام...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#0f172a',
        color: '#ffffff',
        fontFamily: 'Cairo, sans-serif'
      }}>
        <div style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '16px',
          padding: '40px',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div style={{
            backgroundColor: localStorage.getItem('logo_timestamp') ? 'transparent' : 'rgba(59, 130, 246, 0.1)',
            padding: localStorage.getItem('logo_timestamp') ? '0' : '16px',
            borderRadius: '16px',
            border: localStorage.getItem('logo_timestamp') ? 'none' : '1px solid rgba(59, 130, 246, 0.2)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <LogoImage imgSize={90} iconSize={44} showWrapper={false} style={{ color: '#3b82f6' }} />
          </div>

          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '6px', textAlign: 'center', color: '#f8fafc' }}>{systemName}</h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '24px', textAlign: 'center' }}>الرجاء إدخال كلمة المرور المخصصة لفتح بوابة المستفيدين</p>

          <form onSubmit={handleLoginSubmit} style={{ width: '100%' }}>
            {loginError && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#f87171',
                fontSize: '0.85rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                lineHeight: '1.4'
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{loginError}</span>
              </div>
            )}

            <div style={{ marginBottom: '20px', width: '100%' }}>
              <input 
                type="password" 
                placeholder="أدخل كلمة المرور..."
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#ffffff',
                  outline: 'none',
                  fontSize: '1.1rem',
                  textAlign: 'center',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>

            <button 
              type="submit" 
              disabled={loginLoading || !loginPassword.trim()}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#3b82f6',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background-color 0.2s'
              }}
            >
              {loginLoading ? <RefreshCw size={16} className="spin" /> : <Check size={18} />}
              {loginLoading ? "جاري التحقق..." : "فتح قفل النظام"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Right Sidebar (for Arabic RTL layout) */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <LogoImage imgSize={48} iconSize={24} showWrapper={true} />
          <h1>{sidebarTitle}</h1>
        </div>

        <nav className="sidebar-menu">
          {currentUser.role === 'admin' && (
            <div 
              className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={20} />
              <span>لوحة التحكم</span>
            </div>
          )}

          <div 
            className={`menu-item ${activeTab === 'database' ? 'active' : ''}`}
            onClick={() => setActiveTab('database')}
          >
            <DbIcon size={20} />
            <span>قاعدة البيانات العامة</span>
          </div>

          {currentUser.role === 'admin' && (
            <>
              <div 
                className={`menu-item ${activeTab === 'matching' ? 'active' : ''}`}
                onClick={() => setActiveTab('matching')}
              >
                <Play size={20} />
                <span>الربط الذكي للبطائق</span>
              </div>

              <div 
                className={`menu-item ${activeTab === 'projects' ? 'active' : ''}`}
                onClick={() => setActiveTab('projects')}
              >
                <FolderGit2 size={20} />
                <span>إدارة المشاريع</span>
              </div>

              <div 
                className={`menu-item ${activeTab === 'data-management' ? 'active' : ''}`}
                onClick={() => setActiveTab('data-management')}
              >
                <RefreshCw size={20} />
                <span>إدارة وصيانة البيانات</span>
              </div>

              <div 
                className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <Shield size={20} />
                <span>إعدادات النظام</span>
              </div>
            </>
          )}
        </nav>

        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>الحساب: {currentUser.name}</span>
            <button className="theme-toggle" onClick={toggleTheme} title="تغيير المظهر">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
          
          <button 
            className="btn btn-secondary" 
            style={{ 
              width: '100%', 
              padding: '6px 12px', 
              fontSize: '0.8rem', 
              color: 'var(--danger)', 
              borderColor: 'rgba(239, 68, 68, 0.2)',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              minHeight: '34px'
            }} 
            onClick={handleLogout}
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Panel Area */}
      <div className="main-wrapper">
        <header className="header">
          <div className="header-title">
            <h2>
              {activeTab === 'dashboard' && 'لوحة التحكم'}
              {activeTab === 'database' && 'قاعدة البيانات العامة للمستفيدين'}
              {activeTab === 'matching' && 'أداة الربط واقتصاص البطائق'}
              {activeTab === 'projects' && 'المشاريع وتوزيع المستحقين'}
              {activeTab === 'data-management' && 'إدارة وصيانة البيانات والمهام'}
              {activeTab === 'settings' && 'إعدادات النظام وإدارة الصلاحيات'}
            </h2>
          </div>
          
          <div className="header-actions">
            {activeTab !== 'matching' && currentUser.role === 'admin' && !(window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') && (
              <button className="btn btn-success" onClick={() => setIsImportOpen(true)}>
                <Upload size={16} />
                استيراد إكسل
              </button>
            )}
            <div style={{ fontSize: '0.85rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--success-light)', padding: '6px 12px', borderRadius: '20px', fontWeight: 600 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)', display: 'inline-block' }}></span>
              قاعدة البيانات متصلة
            </div>
          </div>
        </header>

        <main className="content-container">
          {activeTab === 'dashboard' && currentUser.role === 'admin' && (
            <Dashboard 
              setActiveTab={setActiveTab} 
              triggerImport={() => setIsImportOpen(true)} 
            />
          )}
          {activeTab === 'database' && (
            <Database 
              activeTab={activeTab} 
              triggerExcelUploadFlag={triggerExcelUploadFlag} 
              resetImportFlag={() => setTriggerExcelUploadFlag(false)} 
              isAdmin={currentUser.role === 'admin'}
            />
          )}
          {activeTab === 'matching' && currentUser.role === 'admin' && <Matching />}
          {activeTab === 'projects' && currentUser.role === 'admin' && <Projects />}
          {activeTab === 'data-management' && currentUser.role === 'admin' && <DataManagement />}
          {activeTab === 'settings' && currentUser.role === 'admin' && <Settings />}
        </main>
      </div>

      {/* EXCEL IMPORT WIZARD MODAL */}
      {isImportOpen && (
        <div className="modal-overlay" onClick={resetImport}>
          <div 
            className="modal-content" 
            style={{ 
              maxWidth: importAnalysis ? '950px' : '550px', 
              transition: 'max-width 0.3s ease' 
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 style={{ fontWeight: 800 }}>معالج استيراد المستفيدين من Excel</h3>
              <button className="modal-close" onClick={resetImport}>
                <X size={20} />
              </button>
            </div>

            {/* Step 1: Uploading Screen */}
            {!excelFile && !importSuccess && (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <label 
                  style={{
                    border: '2px dashed var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '40px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    gap: '16px',
                    transition: 'border-color var(--transition-fast)'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <Upload size={48} style={{ color: 'var(--primary)' }} />
                  <div>
                    <h4 style={{ fontWeight: 700, marginBottom: '6px' }}>اسحب ملف Excel هنا أو اضغط للتصفح</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      يدعم الملفات بصيغة .xlsx أو .xls. تأكد من احتواء الملف على عمود "الاسم الكامل" على الأقل.
                    </p>
                  </div>
                  <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleFileChange} />
                </label>
              </div>
            )}

            {/* Loading Indicator */}
            {importLoading && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
                <RefreshCw size={40} className="spin" style={{ color: 'var(--primary)', marginBottom: '16px' }} />
                <h4>جاري تحليل محتويات الملف وفحص الأسماء المكررة...</h4>
              </div>
            )}

            {/* Step 2: Analysis Report & Deduplication Options */}
            {importAnalysis && !importLoading && (
              <div>
                <div style={{ 
                  display: 'flex', 
                  gap: '16px', 
                  backgroundColor: 'var(--bg-tertiary)', 
                  padding: '16px 20px', 
                  borderRadius: 'var(--radius-md)', 
                  marginBottom: '24px',
                  alignItems: 'center'
                }}>
                  <Info size={24} style={{ color: 'var(--primary)' }} />
                  <div>
                    <h4 style={{ fontWeight: 700 }}>تقرير الفحص الأولي للملف:</h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      إجمالي الصفوف: <strong>{importAnalysis.total}</strong> | 
                      حالات جديدة سيتم إدراجها: <strong style={{ color: 'var(--success)' }}>{importAnalysis.newItems.length}</strong> | 
                      حالات مكررة تحتاج مراجعة: <strong style={{ color: 'var(--danger)' }}>{importAnalysis.duplicates.length}</strong>
                    </p>
                  </div>
                </div>

                {importAnalysis.duplicates.length > 0 ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h4 style={{ fontWeight: 800 }}>الحالات المكررة المكتشفة:</h4>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>تطبيق إجراء جماعي:</span>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => setGlobalAction('skip')}>تجاوز الكل</button>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => setGlobalAction('update')}>تحديث الكل</button>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => setGlobalAction('force')}>إدخال مكرر</button>
                      </div>
                    </div>

                    {/* Conflict List Table */}
                    <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '24px' }}>
                      <table className="data-table" style={{ fontSize: '0.85rem' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr>
                            <th style={{ padding: '10px 16px' }}>سطر الإكسل</th>
                            <th style={{ padding: '10px 16px' }}>الاسم المدخل حديثاً</th>
                            <th style={{ padding: '10px 16px' }}>السجل الحالي بقاعدة البيانات</th>
                            <th style={{ padding: '10px 16px' }}>الإجراء المطلوب</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importAnalysis.duplicates.map(dup => (
                            <tr key={dup.rowNum}>
                              <td style={{ padding: '12px 16px', fontWeight: 600 }}>{dup.rowNum}</td>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ fontWeight: 700 }}>{dup.item.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>هاتف: {dup.item.phone || '—'} | هوية: {dup.item.id_number || '—'}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dup.item.region} / {dup.item.district}</div>
                              </td>
                              <td style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.03)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', fontWeight: 600, fontSize: '0.8rem', marginBottom: '2px' }}>
                                  <AlertTriangle size={12} />
                                  تطابق {dup.duplicateType === 'name' ? 'الاسم ذكياً' : dup.duplicateType === 'phone' ? 'الهاتف' : 'رقم الهوية'}
                                </div>
                                <div style={{ fontWeight: 700 }}>{dup.existingRecord.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>هاتف: {dup.existingRecord.phone || '—'} | هوية: {dup.existingRecord.id_number || '—'}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{dup.existingRecord.region} ({dup.existingRecord.district})</div>
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <select 
                                  className="filter-select"
                                  style={{ padding: '6px 12px', fontSize: '0.85rem', width: '100%' }}
                                  value={duplicateActions[dup.rowNum]}
                                  onChange={(e) => handleActionChangeForDuplicate(dup.rowNum, e.target.value)}
                                >
                                  <option value="skip">تجاوز (تخطي)</option>
                                  <option value="update">تحديث السجل الحالي</option>
                                  <option value="force">استيراد كحالة مكررة</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px 0' }}>
                    <p style={{ color: 'var(--success)', fontWeight: 700, fontSize: '1.1rem' }}>🎉 رائع! لم يتم العثور على أي أسماء مكررة في الملف.</p>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>جميع المستفيدين المدرجين سيتم حفظهم كحالات جديدة في النظام.</p>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button className="btn btn-secondary" onClick={resetImport}>إلغاء</button>
                  <button className="btn btn-success" onClick={handleConfirmImport}>
                    تأكيد إكمال الاستيراد لقاعدة البيانات
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Success Screen */}
            {importSuccess && (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ 
                  width: '64px', 
                  height: '64px', 
                  borderRadius: '50%', 
                  backgroundColor: 'var(--success-light)', 
                  color: 'var(--success)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 20px'
                }}>
                  <Check size={36} />
                </div>
                <h3 style={{ fontWeight: 800, marginBottom: '12px' }}>اكتمل الاستيراد بنجاح!</h3>
                <div style={{ 
                  backgroundColor: 'var(--bg-tertiary)', 
                  padding: '16px', 
                  borderRadius: 'var(--radius-md)', 
                  maxWidth: '350px',
                  margin: '0 auto 24px',
                  textAlign: 'right',
                  fontSize: '0.9rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div>🔹 مستفيدين جدد تم إضافتهم: <strong>{importSuccess.inserted}</strong></div>
                  {importSuccess.updated > 0 && <div>🔹 سجلات قديمة تم تحديث بياناتها: <strong>{importSuccess.updated}</strong></div>}
                  {importSuccess.skipped > 0 && <div>🔹 سجلات مكررة تم تجاوز استيرادها: <strong>{importSuccess.skipped}</strong></div>}
                </div>
                <button className="btn btn-primary" onClick={resetImport}>العودة للبرنامج</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
