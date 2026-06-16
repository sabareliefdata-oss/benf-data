import React, { useState, useEffect } from 'react';
import { 
  Users2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Download, 
  Printer, 
  Settings as SettingsIcon, 
  LogOut, 
  ChevronLeft, 
  ChevronRight, 
  Lock, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Eye,
  Menu,
  X,
  Globe,
  Languages
} from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5005' : '';
const getApiUrl = (path) => `${API_BASE}${path}`;

// Custom Searchable Dropdown (Combobox) Component
function SearchableSelect({ value, onChange, options, placeholder, emptyPlaceholder, isRtl }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = React.useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    String(opt).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="combobox-container" ref={containerRef}>
      <div 
        className="form-control" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          cursor: 'pointer', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          minHeight: '42px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || placeholder}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>▼</span>
      </div>

      {isOpen && (
        <div className="combobox-dropdown">
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>
            <input
              type="text"
              className="form-control"
              placeholder={isRtl ? "اكتب للبحث..." : "Type to search..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              style={{ padding: '6px 10px', fontSize: '0.85rem' }}
            />
          </div>
          <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
            <div 
              className={`combobox-item ${!value ? 'active' : ''}`}
              onClick={() => { onChange(''); setIsOpen(false); setSearchQuery(''); }}
            >
              {isRtl ? "الكل" : "All"}
            </div>
            {filteredOptions.length === 0 ? (
              <div className="combobox-no-results">
                {emptyPlaceholder || (isRtl ? "لا توجد نتائج" : "No results")}
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <div
                  key={opt}
                  className={`combobox-item ${value === opt ? 'active' : ''}`}
                  onClick={() => { onChange(opt); setIsOpen(false); setSearchQuery(''); }}
                >
                  {opt}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // App state
  const [activeTab, setActiveTab] = useState('arabic'); // 'arabic' | 'english' | 'settings'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('sabaTheme') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('sabaTheme', theme);
    document.body.className = `theme-${theme}`;
  }, [theme]);
  
  // Data state
  const [records, setRecords] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Dashboard stats
  const [stats, setStats] = useState({ total: 0, linked: 0, pending: 0, missing: 0, projects: 0 });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [search, setSearch] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [district, setDistrict] = useState('');
  const [region, setRegion] = useState('');
  const [delegate, setDelegate] = useState('');
  const [cardStatus, setCardStatus] = useState('');
  const [projectId, setProjectId] = useState('');

  // Selected beneficiary for detailed view drawer
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);

  // Debounce search input
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setSearch(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // Dropdown lists
  const [metadata, setMetadata] = useState({
    governorates: [], districts: [], delegates: [],
    governoratesEn: [], districtsEn: [], delegatesEn: [],
    projects: []
  });

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Settings state
  const [apiKey, setApiKey] = useState('');
  const [configSaving, setConfigSaving] = useState(false);

  // User Management state
  const [usersList, setUsersList] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('arabic_viewer');
  const [usersLoading, setUsersLoading] = useState(false);

  // Modal / Preview state
  const [previewFileId, setPreviewFileId] = useState(null);
  const [previewRecordName, setPreviewRecordName] = useState('');

  // Auto session check
  useEffect(() => {
    const savedUser = localStorage.getItem('sabaUser');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        if (parsed.role === 'arabic_viewer') setActiveTab('arabic');
        if (parsed.role === 'english_viewer') setActiveTab('english');
      } catch (e) {
        localStorage.removeItem('sabaUser');
      }
    }
  }, []);

  // Fetch stats on load or when activeTab changes
  useEffect(() => {
    if (currentUser) {
      fetchStats();
    }
  }, [currentUser, activeTab]);

  // Fetch metadata on load (if logged in)
  useEffect(() => {
    if (currentUser) {
      fetchMetadata();
    }
  }, [currentUser]);

  // Fetch records whenever page or filters change
  useEffect(() => {
    if (currentUser) {
      fetchRecords();
    }
  }, [currentUser, activeTab, currentPage, search, governorate, district, region, delegate, cardStatus, projectId]);

  // Reset page when filter changes
  const resetFilters = () => {
    setSearchTerm('');
    setSearch('');
    setGovernorate('');
    setDistrict('');
    setRegion('');
    setDelegate('');
    setCardStatus('');
    setProjectId('');
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  const fetchStats = async () => {
    try {
      const lang = activeTab === 'english' ? 'en' : 'ar';
      const res = await fetch(getApiUrl(`/api/dashboard-stats?lang=${lang}`));
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard stats", err);
    }
  };

  const fetchMetadata = async () => {
    try {
      const res = await fetch(getApiUrl('/api/metadata'));
      if (res.ok) {
        const data = await res.json();
        setMetadata(data);
      }
    } catch (err) {
      console.error("Failed to fetch metadata", err);
    }
  };

  const fetchRecords = async () => {
    if (activeTab === 'settings') return;
    setLoading(true);
    try {
      const endpoint = activeTab === 'english' ? '/api/beneficiaries-en' : '/api/beneficiaries';
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '100'
      });
      if (search) params.append('search', search);
      if (governorate) params.append('governorate', governorate);
      if (district) params.append('district', district);
      if (region) params.append('region', region);
      if (delegate) params.append('delegate', delegate);
      if (cardStatus) params.append('card_status', cardStatus);
      if (projectId) params.append('project_id', projectId);

      const res = await fetch(getApiUrl(`${endpoint}?${params.toString()}`));
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records);
        setTotalPages(data.pages);
        setTotalRecords(data.total);
      }
    } catch (err) {
      console.error("Failed to fetch records", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch(getApiUrl('/api/config'));
      if (res.ok) {
        const data = await res.json();
        setApiKey(data.apiKey || '');
      }
    } catch (err) {
      console.error("Failed to fetch config", err);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/users'));
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && activeTab === 'settings' && currentUser.role === 'admin') {
      fetchConfig();
      fetchUsers();
    }
  }, [currentUser, activeTab]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) return;

    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: loginUsername.trim(),
          password: loginPassword.trim() 
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentUser(data.user);
        localStorage.setItem('sabaUser', JSON.stringify(data.user));
        setLoginUsername('');
        setLoginPassword('');
        if (data.user.role === 'arabic_viewer') {
          setActiveTab('arabic');
        } else if (data.user.role === 'english_viewer') {
          setActiveTab('english');
        } else {
          setActiveTab('arabic');
        }
      } else {
        setLoginError(data.error || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
      }
    } catch (err) {
      setLoginError('فشل الاتصال بخادم النظام.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm(activeTab === 'english' ? 'Are you sure you want to logout?' : 'هل أنت متأكد من رغبتك في تسجيل الخروج؟')) {
      setCurrentUser(null);
      localStorage.removeItem('sabaUser');
      setSelectedIds(new Set());
      setRecords([]);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = records.map(r => r.id);
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id) => {
    const updated = new Set(selectedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedIds(updated);
  };

  // Export excel
  const handleExportExcel = () => {
    const params = new URLSearchParams();
    if (selectedIds.size > 0) {
      params.append('ids', Array.from(selectedIds).join(','));
    } else {
      if (search) params.append('search', search);
      if (governorate) params.append('governorate', governorate);
      if (district) params.append('district', district);
      if (region) params.append('region', region);
      if (delegate) params.append('delegate', delegate);
      if (cardStatus) params.append('card_status', cardStatus);
      if (projectId) params.append('project_id', projectId);
    }
    const endpoint = activeTab === 'english' ? '/api/export/beneficiaries-en' : '/api/export/beneficiaries';
    window.open(getApiUrl(`${endpoint}?${params.toString()}`));
  };

  // Cards print PDF
  const handlePrintCards = () => {
    const params = new URLSearchParams();
    params.append('lang', activeTab === 'english' ? 'en' : 'ar');
    if (selectedIds.size > 0) {
      params.append('ids', Array.from(selectedIds).join(','));
    } else {
      if (search) params.append('search', search);
      if (governorate) params.append('governorate', governorate);
      if (district) params.append('district', district);
      if (region) params.append('region', region);
      if (delegate) params.append('delegate', delegate);
      if (cardStatus) params.append('card_status', cardStatus);
      if (projectId) params.append('project_id', projectId);
    }
    window.open(getApiUrl(`/api/export/cards-print?${params.toString()}`), '_blank');
  };

  // Export selected cards as ZIP
  const handleExportZip = () => {
    const params = new URLSearchParams();
    if (selectedIds.size > 0) {
      params.append('ids', Array.from(selectedIds).join(','));
    } else {
      if (search) params.append('search', search);
      if (governorate) params.append('governorate', governorate);
      if (district) params.append('district', district);
      if (region) params.append('region', region);
      if (delegate) params.append('delegate', delegate);
      if (cardStatus) params.append('card_status', cardStatus);
      if (projectId) params.append('project_id', projectId);
    }
    window.open(getApiUrl(`/api/export/zip-cards?${params.toString()}`));
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setConfigSaving(true);
    try {
      const res = await fetch(getApiUrl('/api/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      if (res.ok) {
        alert('تم حفظ مفتاح الـ API بنجاح!');
      } else {
        alert('فشل حفظ الإعدادات.');
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم.');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newName.trim() || !newPassword.trim()) {
      alert('يرجى ملء جميع الحقول');
      return;
    }
    try {
      const res = await fetch(getApiUrl('/api/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          name: newName.trim(),
          password: newPassword.trim(),
          role: newRole
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('تم إضافة المستخدم بنجاح!');
        setNewUsername('');
        setNewName('');
        setNewPassword('');
        setNewRole('arabic_viewer');
        fetchUsers();
      } else {
        alert(data.error || 'فشل إضافة المستخدم.');
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم.');
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (username === 'admin') {
      alert('لا يمكن حذف حساب المدير الرئيسي');
      return;
    }
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف المستخدم "${username}"؟`)) {
      return;
    }
    try {
      const res = await fetch(getApiUrl(`/api/users/${userId}`), {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('تم حذف المستخدم بنجاح!');
        fetchUsers();
      } else {
        alert(data.error || 'فشل حذف المستخدم.');
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم.');
    }
  };

  if (!currentUser) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#070a13',
        color: '#ffffff',
        fontFamily: 'Cairo, sans-serif'
      }}>
        <div style={{
          backgroundColor: '#111827',
          border: '1px solid #374151',
          borderRadius: '16px',
          padding: '40px',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <img 
            src="/logo.png" 
            alt="Logo" 
            style={{ 
              width: '120px', 
              height: '120px', 
              objectFit: 'contain', 
              marginBottom: '16px' 
            }} 
            onError={(e) => {
              // fallback if logo fails to load
              e.target.style.display = 'none';
            }}
          />

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '2px', textAlign: 'center', color: '#ffffff' }}>Beneficiary DB</h2>
          <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '24px', textAlign: 'center' }}>قاعدة بيانات المستفيدين</p>

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
                <span>{loginError}</span>
              </div>
            )}

            <div style={{ marginBottom: '14px', width: '100%' }}>
              <input 
                type="text" 
                placeholder="اسم المستخدم (Username)..."
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: '#0b0f19',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#ffffff',
                  outline: 'none',
                  fontSize: '1rem',
                  textAlign: 'center'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px', width: '100%' }}>
              <input 
                type="password" 
                placeholder="كلمة المرور (Password)..."
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: '#0b0f19',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#ffffff',
                  outline: 'none',
                  fontSize: '1rem',
                  textAlign: 'center'
                }}
              />
            </div>

            <button 
              type="submit" 
              disabled={loginLoading || !loginUsername.trim() || !loginPassword.trim()}
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
                gap: '8px'
              }}
            >
              {loginLoading ? <RefreshCw size={16} className="spin" /> : <Lock size={18} />}
              {loginLoading ? "جاري التحقق..." : "تسجيل الدخول"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isRtl = activeTab === 'arabic';

  return (
    <div className={`app-container theme-${theme}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          padding: '20px 10px', 
          borderBottom: '1px solid var(--border)', 
          gap: '8px' 
        }}>
          <img 
            src="/logo.png" 
            alt="Logo" 
            style={{ width: isSidebarCollapsed ? '32px' : '55px', height: isSidebarCollapsed ? '32px' : '55px', objectFit: 'contain' }} 
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          {!isSidebarCollapsed && (
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Beneficiary DB</h1>
              <p style={{ fontSize: '0.7rem', margin: '2px 0 0 0', color: 'var(--text-muted)' }}>قاعدة بيانات المستفيدين</p>
            </div>
          )}
        </div>

        <nav className="sidebar-menu" style={{ flexGrow: 1 }}>
          {(currentUser.role === 'admin' || currentUser.role === 'arabic_viewer') && (
            <div 
              className={`menu-item ${activeTab === 'arabic' ? 'active' : ''}`}
              onClick={() => { setActiveTab('arabic'); setCurrentPage(1); resetFilters(); }}
              title={isRtl ? 'النسخة العربية' : 'Arabic View'}
            >
              <Globe size={18} />
              {!isSidebarCollapsed && <span>{isRtl ? 'النسخة العربية' : 'Arabic View'}</span>}
            </div>
          )}

          {(currentUser.role === 'admin' || currentUser.role === 'english_viewer') && (
            <div 
              className={`menu-item ${activeTab === 'english' ? 'active' : ''}`}
              onClick={() => { setActiveTab('english'); setCurrentPage(1); resetFilters(); }}
              title={isRtl ? 'النسخة الإنجليزية' : 'English View'}
            >
              <Languages size={18} />
              {!isSidebarCollapsed && <span>{isRtl ? 'النسخة الإنجليزية' : 'English View'}</span>}
            </div>
          )}

          {currentUser.role === 'admin' && (
            <div 
              className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
              title={isRtl ? 'إعدادات النظام' : 'System Settings'}
            >
              <SettingsIcon size={18} />
              {!isSidebarCollapsed && <span>{isRtl ? 'إعدادات النظام' : 'إعدادات النظام'}</span>}
            </div>
          )}
        </nav>

        {/* Sidebar Collapse Button (Tablet only) */}
        <button 
          className="sidebar-collapse-btn" 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isRtl ? (isSidebarCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />) : (isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)}
        </button>

        <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border)', padding: '16px' }}>
          {!isSidebarCollapsed && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600 }}>
              {activeTab === 'english' ? `Welcome, ${currentUser.name}` : `مرحباً، ${currentUser.name}`}
            </div>
          )}
          <button className="btn btn-secondary logout-btn" style={{ width: '100%', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }} onClick={handleLogout} title={isRtl ? 'تسجيل الخروج' : 'Logout'}>
            <LogOut size={16} />
            {!isSidebarCollapsed && <span>{isRtl ? 'تسجيل الخروج' : 'Logout'}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Header Top Bar (Visible only on mobile via media query) */}
      <div className="mobile-header">
        <button className="mobile-hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>
          <Menu size={24} />
        </button>
        <div className="mobile-header-title">
          <img src="/logo.png" alt="Logo" onError={(e) => { e.target.style.display = 'none'; }} />
          <span>Beneficiary DB</span>
        </div>
        <button className="mobile-theme-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          <Eye size={20} />
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src="/logo.png" alt="Logo" style={{ width: '38px', height: '38px', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
                <div>
                  <h1 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Beneficiary DB</h1>
                  <p style={{ fontSize: '0.7rem', margin: '2px 0 0 0', color: 'var(--text-muted)' }}>قاعدة بيانات المستفيدين</p>
                </div>
              </div>
              <button className="mobile-drawer-close-btn" onClick={() => setIsMobileMenuOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="mobile-drawer-body">
              <nav className="sidebar-menu">
                {(currentUser.role === 'admin' || currentUser.role === 'arabic_viewer') && (
                  <div 
                    className={`menu-item ${activeTab === 'arabic' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('arabic'); setCurrentPage(1); resetFilters(); setIsMobileMenuOpen(false); }}
                  >
                    <Globe size={18} />
                    <span>{isRtl ? 'النسخة العربية' : 'Arabic View'}</span>
                  </div>
                )}

                {(currentUser.role === 'admin' || currentUser.role === 'english_viewer') && (
                  <div 
                    className={`menu-item ${activeTab === 'english' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('english'); setCurrentPage(1); resetFilters(); setIsMobileMenuOpen(false); }}
                  >
                    <Languages size={18} />
                    <span>{isRtl ? 'النسخة الإنجليزية' : 'English View'}</span>
                  </div>
                )}

                {currentUser.role === 'admin' && (
                  <div 
                    className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
                  >
                    <SettingsIcon size={18} />
                    <span>إعدادات النظام</span>
                  </div>
                )}
              </nav>
            </div>

            <div className="mobile-drawer-footer">
              <div className="welcome-text" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600 }}>
                {activeTab === 'english' ? `Welcome, ${currentUser.name}` : `مرحباً، ${currentUser.name}`}
              </div>
              <button className="btn btn-secondary logout-btn" style={{ width: '100%', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }} onClick={handleLogout}>
                <LogOut size={16} />
                <span>{isRtl ? 'تسجيل الخروج' : 'Logout'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Panel */}
      <div className="main-wrapper">
        <header className="header">
          <div className="header-title">
            <h2>
              {activeTab === 'arabic' && 'قاعدة البيانات العامة - عرض عربي'}
              {activeTab === 'english' && 'General Beneficiaries Database - English View'}
              {activeTab === 'settings' && 'إعدادات النظام وإدارة المستخدمين'}
            </h2>
          </div>
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {activeTab === 'english' ? `Welcome, ${currentUser.name}` : `مرحباً، ${currentUser.name}`}
            </span>
            <button 
              className="btn btn-secondary" 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={isRtl ? "تبديل المظهر (فاتح/داكن)" : "Toggle Theme"}
              style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        <main className="content-container">
          {activeTab !== 'settings' ? (
            <div className="fade-in">
              {/* Stats Header */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon" style={{ backgroundColor: 'var(--primary-light)' }}>
                    <Users2 size={24} style={{ color: 'var(--primary)' }} />
                  </div>
                  <div className="stat-info">
                    <h3>{stats.total}</h3>
                    <p>{isRtl ? 'إجمالي الحالات' : 'Total Beneficiaries'}</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ backgroundColor: 'var(--success-light)' }}>
                    <CheckCircle size={24} style={{ color: 'var(--success)' }} />
                  </div>
                  <div className="stat-info">
                    <h3>{stats.linked}</h3>
                    <p>{isRtl ? 'البطاقات المربوطة' : 'Linked Cards'}</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ backgroundColor: 'var(--danger-light)' }}>
                    <XCircle size={24} style={{ color: 'var(--danger)' }} />
                  </div>
                  <div className="stat-info">
                    <h3>{stats.total - stats.linked}</h3>
                    <p>{isRtl ? 'البطاقات غير المربوطة' : 'Unlinked Cards'}</p>
                  </div>
                </div>
              </div>

              {/* Filters Panel */}
              <div style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
                marginBottom: '20px',
                boxShadow: 'var(--shadow)'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{isRtl ? 'البحث الذكي (اسم/هاتف/هوية)' : 'Smart Search (Name/Phone/ID)'}</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder={isRtl ? 'أدخل كلمة البحث...' : 'Type to search...'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingRight: isRtl ? '36px' : '12px', paddingLeft: isRtl ? '12px' : '36px' }}
                      />
                      <Search size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: isRtl ? '12px' : 'auto', left: isRtl ? 'auto' : '12px', color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{isRtl ? 'المحافظة' : 'Governorate'}</label>
                    <select className="form-control" value={governorate} onChange={(e) => { setGovernorate(e.target.value); setCurrentPage(1); }}>
                      <option value="">{isRtl ? 'كل المحافظات' : 'All Governorates'}</option>
                      {(activeTab === 'english' ? metadata.governoratesEn : metadata.governorates).map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{isRtl ? 'المديرية' : 'District'}</label>
                    <select className="form-control" value={district} onChange={(e) => { setDistrict(e.target.value); setCurrentPage(1); }}>
                      <option value="">{isRtl ? 'كل المديريات' : 'All Districts'}</option>
                      {(activeTab === 'english' ? metadata.districtsEn : metadata.districts).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{isRtl ? 'المندوب' : 'Delegate'}</label>
                    <SearchableSelect
                      value={delegate}
                      onChange={(val) => { setDelegate(val); setCurrentPage(1); }}
                      options={activeTab === 'english' ? metadata.delegatesEn : metadata.delegates}
                      placeholder={isRtl ? 'كل المناديب' : 'All Delegates'}
                      emptyPlaceholder={isRtl ? 'لا يوجد مناديب مطابقين' : 'No matching delegates'}
                      isRtl={isRtl}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{isRtl ? 'حالة البطاقة' : 'Card Status'}</label>
                    <select className="form-control" value={cardStatus} onChange={(e) => { setCardStatus(e.target.value); setCurrentPage(1); }}>
                      <option value="">{isRtl ? 'كل الحالات' : 'All Statuses'}</option>
                      <option value="linked">{isRtl ? 'مربوطة' : 'Linked'}</option>
                      <option value="pending">{isRtl ? 'معلقة' : 'Pending'}</option>
                      <option value="missing">{isRtl ? 'مفقودة' : 'Missing'}</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{isRtl ? 'المشروع' : 'Project'}</label>
                    <select className="form-control" value={projectId} onChange={(e) => { setProjectId(e.target.value); setCurrentPage(1); }}>
                      <option value="">{isRtl ? 'كل المشاريع' : 'All Projects'}</option>
                      {metadata.projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <button className="btn btn-secondary" style={{ padding: '10px 14px' }} onClick={resetFilters}>
                    {isRtl ? 'تهيئة الفلاتر' : 'Reset Filters'}
                  </button>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={handleExportExcel}>
                    <Download size={16} />
                    <span>{isRtl ? 'تصدير كشف إكسل للكل/المفلتر' : 'Export Excel (All/Filtered)'}</span>
                  </button>
                  <button className="btn btn-primary" onClick={handlePrintCards}>
                    <Printer size={16} />
                    <span>{isRtl ? 'معاينة وطباعة بطاقات الكل/المفلتر' : 'Print Cards (All/Filtered)'}</span>
                  </button>
                </div>
              </div>

              {/* Data Table (Desktop/Tablet) */}
              <div className="table-responsive desktop-only">
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                    <RefreshCw size={40} className="spin" style={{ color: 'var(--primary)', marginBottom: '16px' }} />
                    <h4>{isRtl ? 'جاري تحميل سجلات المستفيدين...' : 'Loading beneficiaries records...'}</h4>
                  </div>
                ) : records.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                    <h4>{isRtl ? 'لم يتم العثور على أي سجلات مطابقة.' : 'No matching records found.'}</h4>
                  </div>
                ) : (
                  <table className="data-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>
                          <input 
                            type="checkbox" 
                            onChange={handleSelectAll} 
                            checked={records.length > 0 && selectedIds.size === records.length} 
                          />
                        </th>
                        <th>{isRtl ? 'الكود' : 'Code'}</th>
                        <th>{isRtl ? 'الاسم بالكامل' : 'Full Name'}</th>
                        <th>{isRtl ? 'الجنس' : 'Gender'}</th>
                        <th>{isRtl ? 'المحافظة/المديرية' : 'Gov/District'}</th>
                        <th>{isRtl ? 'المنطقة' : 'Region'}</th>
                        <th>{isRtl ? 'رقم الهاتف' : 'Phone'}</th>
                        <th>{isRtl ? 'الهوية الوطنية' : 'National ID'}</th>
                        <th>{isRtl ? 'المهنة' : 'Occupation'}</th>
                        <th>{isRtl ? 'حالة البطاقة' : 'Card Status'}</th>
                        <th>{isRtl ? 'معاينة' : 'Preview'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map(row => (
                        <tr key={row.id}>
                          <td>
                            <input 
                              type="checkbox" 
                              checked={selectedIds.has(row.id)}
                              onChange={() => handleSelectRow(row.id)}
                            />
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{row.code || '—'}</td>
                          <td style={{ fontWeight: 600 }}>{row.name}</td>
                          <td>{row.gender || '—'}</td>
                          <td>{row.governorate} / {row.district}</td>
                          <td>{row.region || '—'}</td>
                          <td>{row.phone || '—'}</td>
                          <td>{row.id_number || '—'}</td>
                          <td>{row.occupation || '—'}</td>
                          <td>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              backgroundColor: 
                                row.card_status?.toLowerCase() === 'linked' || row.card_status === 'مربوطة'
                                  ? 'var(--success-light)'
                                  : row.card_status?.toLowerCase() === 'missing' || row.card_status === 'مفقودة'
                                    ? 'var(--danger-light)'
                                    : 'var(--warning-light)',
                              color: 
                                row.card_status?.toLowerCase() === 'linked' || row.card_status === 'مربوطة'
                                  ? 'var(--success)'
                                  : row.card_status?.toLowerCase() === 'missing' || row.card_status === 'مفقودة'
                                    ? 'var(--danger)'
                                    : 'var(--warning)'
                            }}>
                              {row.card_status}
                            </span>
                          </td>
                          <td>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 8px' }} 
                              onClick={() => setSelectedBeneficiary(row)} 
                              title={isRtl ? "عرض كامل التفاصيل" : "View Full Details"}
                            >
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Mobile Beneficiary Cards List (Mobile-only) */}
              <div className="mobile-only mobile-beneficiary-list">
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    <RefreshCw size={32} className="spin" style={{ color: 'var(--primary)', marginBottom: '12px' }} />
                    <h4>{isRtl ? 'جاري تحميل السجلات...' : 'Loading records...'}</h4>
                  </div>
                ) : records.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    <h4>{isRtl ? 'لم يتم العثور على أي سجلات.' : 'No records found.'}</h4>
                  </div>
                ) : (
                  <div className="mobile-cards-grid">
                    {records.map(row => (
                      <div key={row.id} className="mobile-beneficiary-card">
                        <div className="mobile-card-header">
                          <span className="mobile-card-code">{row.code || '—'}</span>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            backgroundColor: 
                              row.card_status?.toLowerCase() === 'linked' || row.card_status === 'مربوطة'
                                ? 'var(--success-light)'
                                : row.card_status?.toLowerCase() === 'missing' || row.card_status === 'مفقودة'
                                  ? 'var(--danger-light)'
                                  : 'var(--warning-light)',
                            color: 
                              row.card_status?.toLowerCase() === 'linked' || row.card_status === 'مربوطة'
                                ? 'var(--success)'
                                : row.card_status?.toLowerCase() === 'missing' || row.card_status === 'مفقودة'
                                  ? 'var(--danger)'
                                  : 'var(--warning)'
                          }}>
                            {row.card_status}
                          </span>
                        </div>
                        <div className="mobile-card-name">{row.name}</div>
                        <div className="mobile-card-details">
                          <div><strong>{isRtl ? 'الموقع:' : 'Location:'}</strong> {row.governorate} / {row.district}</div>
                          <div><strong>{isRtl ? 'الهاتف:' : 'Phone:'}</strong> {row.phone || '—'}</div>
                        </div>
                        <div className="mobile-card-actions">
                          <button 
                            className="btn btn-secondary" 
                            style={{ flex: 1, padding: '10px 14px', fontSize: '0.85rem' }} 
                            onClick={() => setSelectedBeneficiary(row)}
                          >
                            <Eye size={16} />
                            <span>{isRtl ? 'عرض كامل التفاصيل' : 'View Full Details'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px' }}>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px' }} disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>
                    {isRtl ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                  </button>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    {isRtl ? `صفحة ${currentPage} من ${totalPages} (إجمالي ${totalRecords})` : `Page ${currentPage} of ${totalPages} (Total ${totalRecords})`}
                  </span>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px' }} disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}>
                    {isRtl ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                  </button>
                </div>
              )}

              {/* Floating Action Bar (When rows are selected) */}
              {selectedIds.size > 0 && (
                <div className="floating-actions-bar">
                  <span style={{ fontWeight: 'bold' }}>
                    {isRtl ? `تم تحديد ${selectedIds.size} مستفيد:` : `${selectedIds.size} selected:`}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-success" onClick={handleExportExcel}>
                      <Download size={16} />
                      <span>{isRtl ? 'تصدير كشف إكسل للمحدد' : 'Export Excel Selected'}</span>
                    </button>
                    <button className="btn btn-primary" onClick={handlePrintCards}>
                      <Printer size={16} />
                      <span>{isRtl ? 'تصدير بطاقات PDF للمحدد' : 'Print PDF Selected'}</span>
                    </button>
                    <button className="btn btn-secondary" onClick={handleExportZip}>
                      <Download size={16} />
                      <span>{isRtl ? 'تحميل صور بطاقات ZIP' : 'Download ZIP Selected'}</span>
                    </button>
                    <button className="btn btn-secondary" onClick={() => setSelectedIds(new Set())}>
                      <span>{isRtl ? 'إلغاء التحديد' : 'Deselect'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Settings Tab View
            <div className="fade-in" style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* API Key Configuration */}
              <div style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                boxShadow: 'var(--shadow)'
              }}>
                <h3 style={{ fontWeight: 800, marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>إعدادات الربط والترجمة الآلية</h3>
                <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">مفتاح الاتصال الخاص بجيميني (Gemini API Key)</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      placeholder="أدخل مفتاح الـ API للترجمة..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary" type="submit" disabled={configSaving}>
                      {configSaving ? <RefreshCw size={16} className="spin" /> : null}
                      <span>حفظ مفتاح الـ API</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* User Management Section */}
              <div style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                boxShadow: 'var(--shadow)',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px'
              }}>
                <div>
                  <h3 style={{ fontWeight: 800, marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>إدارة مستخدمي النظام والصلاحيات</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    يمكنك إضافة حسابات للمستخدمين الآخرين وتحديد الصلاحيات الخاصة بهم للدخول إلى بوابة العرض.
                  </p>
                </div>

                {/* Users Table */}
                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '12px', fontSize: '0.95rem', color: 'var(--primary)' }}>المستخدمين النشطين حالياً</h4>
                  {usersLoading ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>جاري تحميل المستخدمين...</div>
                  ) : (
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>الاسم الظاهر</th>
                            <th>اسم المستخدم (Username)</th>
                            <th>نوع الصلاحية</th>
                            <th style={{ width: '80px', textAlign: 'center' }}>إجراءات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usersList.map((user) => (
                            <tr key={user.id}>
                              <td style={{ fontWeight: 700 }}>{user.name}</td>
                              <td>{user.username}</td>
                              <td>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  backgroundColor: user.role === 'admin' ? 'rgba(59, 130, 246, 0.15)' : user.role === 'arabic_viewer' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                  color: user.role === 'admin' ? '#3b82f6' : user.role === 'arabic_viewer' ? '#10b981' : '#f59e0b'
                                }}>
                                  {user.role === 'admin' ? 'مدير' : user.role === 'arabic_viewer' ? 'متصفح عربي' : 'متصفح إنجليزي'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button 
                                  className="btn btn-secondary" 
                                  type="button" 
                                  disabled={user.username === 'admin' || user.username === currentUser.username}
                                  style={{ padding: '4px 8px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }} 
                                  onClick={() => handleDeleteUser(user.id, user.username)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Add User Form */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                  <h4 style={{ fontWeight: 700, marginBottom: '16px', fontSize: '0.95rem', color: 'var(--primary)' }}>إضافة مستخدم جديد</h4>
                  <form onSubmit={handleAddUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">اسم المستخدم (Username - إنجليزي)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="مثال: ahmad"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">الاسم الكامل (يظهر في الترحيب)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="مثال: أحمد محمد"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">كلمة المرور (Password)</label>
                      <input 
                        type="password" 
                        className="form-control" 
                        placeholder="أدخل كلمة المرور..."
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">نوع الصلاحية (Role)</label>
                      <select 
                        className="form-control" 
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                      >
                        <option value="arabic_viewer">متصفح عربي (Arabic Viewer)</option>
                        <option value="english_viewer">متصفح إنجليزي (English Viewer)</option>
                        <option value="admin">مدير النظام (Admin)</option>
                      </select>
                    </div>
                    <div>
                      <button className="btn btn-success" type="submit" style={{ width: '100%', height: '42px' }}>
                        <Plus size={18} />
                        <span>إضافة مستخدم</span>
                      </button>
                    </div>
                  </form>
                </div>

              </div>

            </div>
          )}
        </main>
      </div>

      {/* Details Side Drawer */}
      {selectedBeneficiary && (
        <div className="drawer-overlay" onClick={() => setSelectedBeneficiary(null)}>
          <div className="drawer-content" style={{ width: '550px' }} onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3 style={{ fontWeight: 800 }}>
                {isRtl ? 'تفاصيل المستفيد الكاملة' : 'Full Beneficiary Details'}
              </h3>
              <button className="modal-close" onClick={() => setSelectedBeneficiary(null)}>
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="drawer-body" dir={isRtl ? 'rtl' : 'ltr'}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
                
                {/* 1. Personal Info */}
                <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    {isRtl ? 'البيانات الأساسية للمستفيد' : 'Basic Information'}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                    <div><strong>{isRtl ? 'كود المستفيد:' : 'Code:'}</strong> {selectedBeneficiary.code || '—'}</div>
                    <div><strong>{isRtl ? 'الاسم الكامل:' : 'Full Name:'}</strong> {selectedBeneficiary.name}</div>
                    <div><strong>{isRtl ? 'الجنس:' : 'Gender:'}</strong> {selectedBeneficiary.gender || '—'}</div>
                    <div><strong>{isRtl ? 'تاريخ الميلاد:' : 'Birth Date:'}</strong> {selectedBeneficiary.birth_date || '—'}</div>
                    <div><strong>{isRtl ? 'الحالة الاجتماعية:' : 'Marital Status:'}</strong> {selectedBeneficiary.marital_status || '—'}</div>
                    <div><strong>{isRtl ? 'المهنة:' : 'Occupation:'}</strong> {selectedBeneficiary.occupation || '—'}</div>
                    <div><strong>{isRtl ? 'حالة الأسرة:' : 'Family Status:'}</strong> {selectedBeneficiary.family_status || '—'}</div>
                  </div>
                </div>

                {/* 2. Contact & IDs */}
                <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    {isRtl ? 'بيانات الاتصال والهوية' : 'Contact & IDs'}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                    <div><strong>{isRtl ? 'رقم الجوال:' : 'Phone:'}</strong> {selectedBeneficiary.phone || '—'}</div>
                    <div><strong>{isRtl ? 'الجوال الاحتياطي:' : 'Backup Phone:'}</strong> {selectedBeneficiary.backup_phone || '—'}</div>
                    <div><strong>{isRtl ? 'نوع الهوية:' : 'ID Type:'}</strong> {selectedBeneficiary.id_type || '—'}</div>
                    <div><strong>{isRtl ? 'رقم الهوية:' : 'ID Number:'}</strong> {selectedBeneficiary.id_number || '—'}</div>
                  </div>
                </div>

                {/* 3. Partner details */}
                <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    {isRtl ? 'بيانات الشريك (الزوج / الزوجة)' : 'Partner Details'}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                    <div style={{ gridColumn: 'span 2' }}><strong>{isRtl ? 'اسم الشريك:' : 'Partner Name:'}</strong> {selectedBeneficiary.partner_name || '—'}</div>
                    <div><strong>{isRtl ? 'جنس الشريك:' : 'Partner Gender:'}</strong> {selectedBeneficiary.partner_gender || '—'}</div>
                    <div><strong>{isRtl ? 'نوع هوية الشريك:' : 'Partner ID Type:'}</strong> {selectedBeneficiary.partner_id_type || '—'}</div>
                    <div style={{ gridColumn: 'span 2' }}><strong>{isRtl ? 'رقم هوية الشريك:' : 'Partner ID Number:'}</strong> {selectedBeneficiary.partner_id_number || '—'}</div>
                  </div>
                </div>

                {/* 4. Geography and Family counts */}
                <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    {isRtl ? 'تفاصيل العنوان وأفراد الأسرة' : 'Address & Family Members'}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem', marginBottom: '12px' }}>
                    <div><strong>{isRtl ? 'المحافظة:' : 'Governorate:'}</strong> {selectedBeneficiary.governorate || '—'}</div>
                    <div><strong>{isRtl ? 'المديرية:' : 'District:'}</strong> {selectedBeneficiary.district || '—'}</div>
                    <div style={{ gridColumn: 'span 2' }}><strong>{isRtl ? 'المنطقة / القرية:' : 'Region/Village:'}</strong> {selectedBeneficiary.region || '—'}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '10px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', textAlign: 'center', marginBottom: '12px' }}>
                    <div><strong>{isRtl ? 'أطفال 1-18' : 'Children 1-18'}</strong><div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>{selectedBeneficiary.children_count || 0}</div></div>
                    <div><strong>{isRtl ? 'بالغين 18-59' : 'Adults 18-59'}</strong><div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>{selectedBeneficiary.adults_count || 0}</div></div>
                    <div><strong>{isRtl ? 'كبار +60' : 'Elderly +60'}</strong><div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>{selectedBeneficiary.elderly_count || 0}</div></div>
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, textAlign: 'center', padding: '8px', border: '1px dashed var(--primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>
                    {isRtl ? 'إجمالي عدد أفراد الأسرة (المسجل):' : 'Total Family Members (Registered):'} <span style={{ color: 'var(--primary)', fontSize: '1rem' }}>{selectedBeneficiary.total_family_count || 0}</span>
                  </div>
                </div>

                {/* 5. Survey and Delegate */}
                <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    {isRtl ? 'بيانات المسح والميدان' : 'Survey & Field Data'}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                    <div><strong>{isRtl ? 'اسم المندوب:' : 'Delegate Name:'}</strong> {selectedBeneficiary.delegate_name || '—'}</div>
                    <div><strong>{isRtl ? 'جوال المندوب:' : 'Delegate Phone:'}</strong> {selectedBeneficiary.delegate_phone || '—'}</div>
                    <div style={{ gridColumn: 'span 2' }}><strong>{isRtl ? 'منطقة المسح الميداني:' : 'Field Survey Area:'}</strong> {selectedBeneficiary.survey_area || '—'}</div>
                  </div>
                </div>

                {selectedBeneficiary.notes && (
                  <div>
                    <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      {isRtl ? 'ملاحظات المندوب' : 'Delegate Notes'}
                    </h4>
                    <p style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                      {selectedBeneficiary.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Card Photo section */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
                  {isRtl ? 'صورة البطاقة التعريفية' : 'ID Card Photo'}
                </h4>
                {selectedBeneficiary.googleDriveFileId ? (
                  <div>
                    <div className="card-preview-box">
                      <img 
                        src={getApiUrl(`/api/cards/${selectedBeneficiary.googleDriveFileId}`)} 
                        alt={selectedBeneficiary.name} 
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                      <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => window.open(getApiUrl(`/api/cards/${selectedBeneficiary.googleDriveFileId}`), '_blank')}>
                        {isRtl ? 'فتح الحجم الكامل' : 'Open Full Size'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="card-preview-box" style={{ padding: '24px 0', color: 'var(--text-muted)' }}>
                    <p>{isRtl ? 'لا توجد بطاقة مربوطة حالياً لهذا المستفيد.' : 'No card linked currently for this beneficiary.'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}