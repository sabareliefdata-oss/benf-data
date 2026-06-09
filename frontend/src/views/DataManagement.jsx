import React, { useState, useEffect } from 'react';
import { Users2, Trash2, FolderGit2, Search, RefreshCw, AlertTriangle, Check, Info } from 'lucide-react';

export default function DataManagement() {
  // Common states
  const [delegates, setDelegates] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadingDelegates, setLoadingDelegates] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Task 1: Unify Delegates States
  const [selectedSources, setSelectedSources] = useState(new Set());
  const [targetName, setTargetName] = useState('');
  const [unifyLoading, setUnifyLoading] = useState(false);
  const [unifyResult, setUnifyResult] = useState(null);

  // Task 2: Clear Notes States
  const [clearScope, setClearScope] = useState('global'); // 'global' or 'project'
  const [clearProjectId, setClearProjectId] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearResult, setClearResult] = useState(null);

  // Task 3: Beneficiary Project History States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [benProjects, setBenProjects] = useState([]);
  const [loadingBenProjects, setLoadingBenProjects] = useState(false);

  // Fetch initial filters and projects
  const fetchDelegates = async () => {
    setLoadingDelegates(true);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/filters-data`);
      if (res.ok) {
        const data = await res.json();
        setDelegates(data.delegates || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDelegates(false);
    }
  };

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/projects`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    fetchDelegates();
    fetchProjects();
  }, []);

  // Task 1: Unify delegates logic
  const handleToggleSource = (name) => {
    const updated = new Set(selectedSources);
    if (updated.has(name)) {
      updated.delete(name);
    } else {
      updated.add(name);
    }
    setSelectedSources(updated);
  };

  const handleUnifyDelegates = async (e) => {
    e.preventDefault();
    if (selectedSources.size === 0) {
      alert("الرجاء تحديد مندوب واحد على الأقل من القائمة لتوحيده.");
      return;
    }
    if (!targetName.trim()) {
      alert("الرجاء إدخال الاسم الموحد المستهدف.");
      return;
    }

    setUnifyLoading(true);
    setUnifyResult(null);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/maintenance/unify-delegates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceNames: Array.from(selectedSources),
          targetName: targetName.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setUnifyResult({ success: true, count: data.changes });
        setSelectedSources(new Set());
        setTargetName('');
        fetchDelegates(); // Refresh delegates list
      } else {
        alert("فشل توحيد المناديب: " + (data.error || "خطأ غير معروف"));
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء دمج المناديب.");
    } finally {
      setUnifyLoading(false);
    }
  };

  // Task 2: Clear notes logic
  const handleClearNotes = async (e) => {
    e.preventDefault();
    if (clearScope === 'project' && !clearProjectId) {
      alert("الرجاء اختيار المشروع المطلوب لمسح ملاحظاته.");
      return;
    }
    if (!confirmClear) {
      alert("الرجاء تفعيل خيار التأكيد أولاً لتجنب مسح الملاحظات بالخطأ.");
      return;
    }

    setClearLoading(true);
    setClearResult(null);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/maintenance/clear-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: clearScope === 'project' ? clearProjectId : null
        })
      });
      const data = await res.json();
      if (res.ok) {
        setClearResult({ success: true, count: data.changes });
        setConfirmClear(false);
      } else {
        alert("فشل مسح الملاحظات: " + (data.error || "خطأ غير معروف"));
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء مسح الملاحظات.");
    } finally {
      setClearLoading(false);
    }
  };

  // Task 3: Search beneficiary & fetch projects logic
  const handleSearchBeneficiaries = async (val) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/beneficiaries?search=${encodeURIComponent(val)}&limit=15`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data || []);
      }
    } catch (e) {
      console.error("Search error", e);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectBeneficiary = async (ben) => {
    setSelectedBeneficiary(ben);
    setSearchResults([]);
    setSearchQuery('');
    setLoadingBenProjects(true);
    setBenProjects([]);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/beneficiaries/${ben.id}/projects`);
      if (res.ok) {
        const data = await res.json();
        setBenProjects(data || []);
      }
    } catch (e) {
      console.error("Failed to load beneficiary projects", e);
    } finally {
      setLoadingBenProjects(false);
    }
  };

  return (
    <div style={{ padding: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-secondary)' }}>إدارة وصيانة البيانات والمهام</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>أدوات متقدمة لتنظيف قاعدة البيانات وتنسيق المناديب وتتبع المشاريع</p>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={() => {
            fetchDelegates();
            fetchProjects();
            if (selectedBeneficiary) handleSelectBeneficiary(selectedBeneficiary);
          }}
          title="تحديث البيانات"
        >
          <RefreshCw size={16} />
          تحديث القوائم
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start', marginBottom: '24px' }}>
        
        {/* Module 1: Unify Delegates */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: 'var(--primary)' }}>
            <Users2 size={20} />
            <h4 style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>توحيد وتهيئة المناديب</h4>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.6', marginBottom: '16px' }}>
            تتيح لك هذه الأداة دمج مسميات المناديب المتكررة أو الخاطئة (مثال: "خالد التميمي"، "خالد امين"، "خالد التميمي اضافة") في مسمى واحد موحد لتسهيل الفرز والفلترة.
          </p>

          <form onSubmit={handleUnifyDelegates}>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>حدد المسميات المصدرية المراد دمجها:</label>
              {loadingDelegates ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>جاري تحميل المناديب...</p>
              ) : delegates.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>لا يوجد مناديب مسجلين حالياً.</p>
              ) : (
                <div style={{ 
                  maxHeight: '180px', 
                  overflowY: 'auto', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '8px',
                  backgroundColor: 'var(--bg-primary)'
                }}>
                  {delegates.map(del => (
                    <label key={del} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', cursor: 'pointer', fontSize: '0.85rem', userSelect: 'none' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedSources.has(del)}
                        onChange={() => handleToggleSource(del)}
                      />
                      <span>{del}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>الاسم الموحد الجديد (المستهدف):</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="اكتب الاسم الموحد للمندوب..."
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                نصيحة: يمكنك كتابة اسم جديد بالكامل، أو اختيار أحد الأسماء المتواجدة بدقة. سيتم توحيد أرقام الهواتف أيضاً تلقائياً إذا وجدت.
              </span>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', fontSize: '0.85rem', minHeight: '38px' }}
              disabled={unifyLoading || selectedSources.size === 0 || !targetName.trim()}
            >
              {unifyLoading ? "جاري دمج وتوحيد المناديب..." : `توحيد المسميات المحددة (${selectedSources.size})`}
            </button>
          </form>

          {unifyResult && (
            <div style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
              <Check size={16} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>تم توحيد الأسماء بنجاح! تم تحديث {unifyResult.count} مستفيد في قاعدة البيانات.</span>
            </div>
          )}
        </div>

        {/* Module 2: Clear Notes */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: 'var(--danger)' }}>
            <Trash2 size={20} />
            <h4 style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>تصفية ومسح ملاحظات المستفيدين</h4>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.6', marginBottom: '16px' }}>
            بعد إكمال كل مشروع، قد ترغب في حذف بيانات الملاحظات القديمة من بطاقات المستفيدين لتهيئة حقل الملاحظات لاستقبال تفاصيل جديدة وتسهيل عمليات الفلترة اللاحقة.
          </p>

          <form onSubmit={handleClearNotes}>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>نطاق مسح الملاحظات:</label>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="clearScope" 
                    checked={clearScope === 'global'} 
                    onChange={() => setClearScope('global')}
                  />
                  <span>كامل قاعدة البيانات العامة</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="clearScope" 
                    checked={clearScope === 'project'} 
                    onChange={() => setClearScope('project')}
                  />
                  <span>مستفيدي مشروع محدد فقط</span>
                </label>
              </div>
            </div>

            {clearScope === 'project' && (
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>اختر المشروع المطلوب:</label>
                {loadingProjects ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>جاري تحميل المشاريع...</p>
                ) : (
                  <select 
                    className="form-control"
                    value={clearProjectId}
                    onChange={(e) => setClearProjectId(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="">-- اختر المشروع --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.beneficiary_count} مستفيد)</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div style={{ 
              backgroundColor: 'var(--bg-tertiary)', 
              padding: '10px 14px', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)', 
              marginBottom: '16px',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)' }}>
                <AlertTriangle size={16} />
                <strong style={{ fontWeight: 700 }}>تحذير: لا يمكن التراجع!</strong>
              </div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                سيؤدي هذا الإجراء إلى تصفير ومسح حقل الملاحظات نهائياً للمستفيدين المحددين بالكامل.
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', cursor: 'pointer', fontWeight: 600 }}>
                <input 
                  type="checkbox" 
                  checked={confirmClear} 
                  onChange={(e) => setConfirmClear(e.target.checked)}
                />
                <span>أنا متأكد من رغبتي في مسح وتصفية الملاحظات</span>
              </label>
            </div>

            <button 
              type="submit" 
              className="btn btn-danger" 
              style={{ width: '100%', fontSize: '0.85rem', minHeight: '38px' }}
              disabled={clearLoading || !confirmClear || (clearScope === 'project' && !clearProjectId)}
            >
              {clearLoading ? "جاري تصفية الملاحظات..." : "مسح الملاحظات المحددة نهائياً"}
            </button>
          </form>

          {clearResult && (
            <div style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
              <Check size={16} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>تم تصفية الملاحظات بنجاح! تم مسح ملاحظات {clearResult.count} مستفيد.</span>
            </div>
          )}
        </div>

      </div>

      {/* Module 3: Beneficiary Project History */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: 'var(--primary)' }}>
          <FolderGit2 size={20} />
          <h4 style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>تتبع سجل مشاريع المستفيدين</h4>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.6', marginBottom: '16px' }}>
          ابحث عن أي مستفيد بالاسم، رقم الجوال أو رقم الهوية للتحقق من كافة المشاريع والبرامج التي تم إضافته إليها مسبقاً وتواريخ توزيع المساعدات له.
        </p>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', position: 'relative', marginBottom: '20px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', right: '12px', top: '11px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="ابحث عن مستفيد بالاسم، الهوية، رقم الجوال أو الكود..."
              value={searchQuery}
              onChange={(e) => handleSearchBeneficiaries(e.target.value)}
              style={{ paddingRight: '36px', fontSize: '0.85rem' }}
            />
          </div>
          
          {searchLoading && <RefreshCw size={18} className="spin" style={{ color: 'var(--text-muted)' }} />}
          
          {/* Autocomplete Dropdown Search Results */}
          {searchResults.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              left: 0,
              zIndex: 100,
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              marginTop: '4px',
              maxHeight: '220px',
              overflowY: 'auto',
              padding: '6px'
            }}>
              {searchResults.map(ben => (
                <div 
                  key={ben.id}
                  onClick={() => handleSelectBeneficiary(ben)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'background-color 0.2s',
                    borderBottom: '1px solid var(--bg-primary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  className="dropdown-item-hover"
                >
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{ben.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>كود: {ben.code || '—'} | الهوية: {ben.id_number || '—'}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-secondary)' }}>{ben.phone || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Beneficiary History Display */}
        {selectedBeneficiary && (
          <div style={{ 
            border: '1px solid var(--border-color)', 
            borderRadius: 'var(--radius-md)', 
            padding: '16px',
            backgroundColor: 'var(--bg-primary)'
          }}>
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>سجل المستفيد</span>
                <h5 style={{ margin: '4px 0 0 0', fontWeight: 800, fontSize: '1.05rem', color: 'var(--primary)' }}>{selectedBeneficiary.name}</h5>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '8px 16px', fontSize: '0.8rem' }}>
                <div><strong>كود المستفيد:</strong> {selectedBeneficiary.code || '—'}</div>
                <div><strong>رقم الجوال:</strong> {selectedBeneficiary.phone || '—'}</div>
                <div><strong>رقم الهوية:</strong> {selectedBeneficiary.id_number || '—'}</div>
                <div><strong>المنطقة:</strong> {selectedBeneficiary.region || '—'}</div>
              </div>
            </div>

            {/* Project List Timeline */}
            <div>
              <h6 style={{ margin: '0 0 12px 0', fontWeight: 700, fontSize: '0.85rem' }}>المشاريع المضاف إليها المستفيد ({benProjects.length})</h6>
              
              {loadingBenProjects ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>جاري استخراج السجل من قاعدة البيانات...</p>
              ) : benProjects.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <Info size={16} />
                  <span>لم يتم إضافة هذا المستفيد إلى أي مشاريع حتى الآن.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {benProjects.map((p, idx) => (
                    <div 
                      key={p.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '10px 14px', 
                        backgroundColor: 'var(--bg-secondary)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: 'var(--radius-sm)' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem' }}>
                          {idx + 1}
                        </span>
                        <strong style={{ fontSize: '0.85rem' }}>{p.name}</strong>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        تاريخ الإضافة: {new Date(p.created_at).toLocaleDateString('ar-YE', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
