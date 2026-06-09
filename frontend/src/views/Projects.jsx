import React, { useState, useEffect, useRef } from 'react';
import { FolderGit2, Plus, ArrowRight, UserCheck, Trash2, FileSpreadsheet, Filter, CheckCircle, Clock, X, Printer, Check, ChevronDown, Search } from 'lucide-react';
const normalizeText = (text) => {
  if (!text) return '';
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة\b/g, "ه")
    .replace(/ى\b/g, "ي")
    .replace(/\s+/g, "");
};

function SearchableSelect({ value, onChange, options, placeholder, emptyMessage = "لا توجد نتائج" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => {
    if (!searchQuery) return true;
    return normalizeText(opt).includes(normalizeText(searchQuery));
  });

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="searchable-select-container" ref={containerRef} style={{ position: 'relative', minWidth: '180px' }}>
      <div 
        className="filter-select select-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          cursor: 'pointer',
          padding: '10px 16px',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.9rem',
          minHeight: '42px',
          userSelect: 'none'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || placeholder}
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>

      {isOpen && (
        <div 
          className="select-dropdown" 
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 999,
            width: '260px',
            marginTop: '4px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div className="dropdown-search" style={{ position: 'relative' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="بحث..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '6px 12px',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
          </div>

          <div 
            className="options-list" 
            style={{
              maxHeight: '200px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}
          >
            <div 
              onClick={() => handleSelect('')}
              className={`dropdown-option ${!value ? 'selected' : ''}`}
            >
              <span>{placeholder}</span>
              {!value && <Check size={14} />}
            </div>

            {filteredOptions.length === 0 ? (
              <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = value === opt;
                return (
                  <div 
                    key={opt}
                    onClick={() => handleSelect(opt)}
                    className={`dropdown-option ${isSelected ? 'selected' : ''}`}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
                    {isSelected && <Check size={14} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectBeneficiaries, setProjectBeneficiaries] = useState([]);
  const [filterDelegate, setFilterDelegate] = useState('');
  const [filterNotes, setFilterNotes] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  
  // Create project form
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');

  // Migration panel form
  const [isMigrateOpen, setIsMigrateOpen] = useState(false);
  const [migDelegate, setMigDelegate] = useState('');
  const [migNotes, setMigNotes] = useState('');
  const [migCandidates, setMigCandidates] = useState([]);
  const [migSelectedIds, setMigSelectedIds] = useState(new Set());
  const [isSearchingCandidates, setIsSearchingCandidates] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ governorates: [], districts: [], regions: [], delegates: [] });

  // Direct add form
  const [isAddDirectOpen, setIsAddDirectOpen] = useState(false);
  const [directCode, setDirectCode] = useState('');
  const [directName, setDirectName] = useState('');
  const [directPhone, setDirectPhone] = useState('');
  const [directIdNum, setDirectIdNum] = useState('');
  const [directDelegate, setDirectDelegate] = useState('');
  const [directGovernorate, setDirectGovernorate] = useState('');
  const [directDistrict, setDirectDistrict] = useState('');
  const [directRegion, setDirectRegion] = useState('');

  // Fetch all projects
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/projects`);
      const data = await res.json();
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch single project details
  const fetchProjectDetails = async (id) => {
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/projects/${id}`);
      const data = await res.json();
      setSelectedProject(data.project);
      setProjectBeneficiaries(data.beneficiaries);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchFilterOptions();
  }, []);

  const fetchFilterOptions = async () => {
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/filters-data`);
      const data = await res.json();
      setFilterOptions(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Create Project handler
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projName) return;

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projName, description: projDesc })
      });
      if (res.ok) {
        setProjName('');
        setProjDesc('');
        setIsCreateOpen(false);
        fetchProjects();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Project handler
  const handleDeleteProject = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا المشروع بالكامل؟ لا يؤدي هذا لحذف المستفيدين من القاعدة العامة.')) return;
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedProject?.id === id) setSelectedProject(null);
        fetchProjects();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Migrate Beneficiaries from main database using filters
  // Search candidates for migration from main database
  const fetchMigrationCandidates = async () => {
    if (!selectedProject) return;
    setIsSearchingCandidates(true);
    setMigCandidates([]);
    setMigSelectedIds(new Set());

    try {
      let url = `${window.API_BASE_URL}/api/projects/${selectedProject.id}/migration-candidates`;
      const queryParams = [];
      if (migDelegate) queryParams.push(`delegate=${encodeURIComponent(migDelegate)}`);
      if (migNotes) queryParams.push(`notes=${encodeURIComponent(migNotes)}`);
      
      if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      setMigCandidates(data);
    } catch (e) {
      console.error(e);
      alert('فشل جلب المرشحين من قاعدة البيانات');
    } finally {
      setIsSearchingCandidates(false);
    }
  };

  // Selection helpers inside the migration modal
  const handleSelectAllMigrate = (e) => {
    if (e.target.checked) {
      setMigSelectedIds(new Set(migCandidates.map(c => c.id)));
    } else {
      setMigSelectedIds(new Set());
    }
  };

  const handleSelectOneMigrate = (id) => {
    const newSelected = new Set(migSelectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setMigSelectedIds(newSelected);
  };

  // Migrate Selected Beneficiaries to project
  const handleMigrate = async (e) => {
    e.preventDefault();
    if (!selectedProject || migSelectedIds.size === 0) return;

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/projects/${selectedProject.id}/migrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(migSelectedIds)
        })
      });
      const data = await res.json();
      alert(`النتيجة: تم ترحيل ${data.migratedCount} مستفيد بنجاح للمشروع.`);
      
      // Reset migration states
      setIsMigrateOpen(false);
      setMigDelegate('');
      setMigNotes('');
      setMigCandidates([]);
      setMigSelectedIds(new Set());
      
      // Refresh project beneficiaries
      fetchProjectDetails(selectedProject.id);
      fetchProjects();
    } catch (e) {
      console.error(e);
      alert('فشل الترحيل');
    }
  };

  // Add Beneficiary Directly
  const handleAddDirect = async (e) => {
    e.preventDefault();
    if (!directName || !selectedProject) return;

    const payload = {
      code: directCode,
      name: directName,
      phone: directPhone,
      id_number: directIdNum,
      delegate_name: directDelegate || selectedProject.name,
      governorate: directGovernorate,
      district: directDistrict,
      region: directRegion
    };

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/projects/${selectedProject.id}/beneficiary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setDirectCode('');
        setDirectName('');
        setDirectPhone('');
        setDirectIdNum('');
        setDirectDelegate('');
        setDirectGovernorate('');
        setDirectDistrict('');
        setDirectRegion('');
        setIsAddDirectOpen(false);
        fetchProjectDetails(selectedProject.id);
        fetchProjects();
      } else {
        const errorData = await res.json();
        alert(`خطأ: ${errorData.error}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Update distribution delivery status
  const handleToggleStatus = async (benId, currentStatus) => {
    const nextStatus = currentStatus === 'delivered' ? 'pending' : 'delivered';
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/projects/${selectedProject.id}/beneficiaries/${benId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        fetchProjectDetails(selectedProject.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Remove beneficiary from project
  const handleRemoveFromProject = async (benId) => {
    if (!confirm('هل تريد استبعاد هذا الاسم من كشف المشروع الحالي فقط؟ (لن يُحذف من القاعدة العامة)')) return;
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/projects/${selectedProject.id}/beneficiaries/${benId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        // Remove from selection if it was selected
        const newSelected = new Set(selectedIds);
        newSelected.delete(benId);
        setSelectedIds(newSelected);

        fetchProjectDetails(selectedProject.id);
        fetchProjects();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Helper to go back to projects list
  const handleBackToProjects = () => {
    setSelectedProject(null);
    setProjectBeneficiaries([]);
    setFilterDelegate('');
    setFilterNotes('');
    setFilterSearch('');
    setSelectedIds(new Set());
    setCurrentPage(1);
    fetchProjects();
  };

  // Get unique delegates in current project beneficiaries
  const projectDelegates = Array.from(new Set(projectBeneficiaries.map(b => b.delegate_name).filter(Boolean))).sort();

  // Client-side filtered beneficiaries
  const filteredBeneficiaries = projectBeneficiaries.filter(b => {
    if (filterDelegate && b.delegate_name !== filterDelegate) return false;
    if (filterNotes) {
      const bNotes = b.notes ? String(b.notes).toLowerCase() : '';
      const fNotes = filterNotes.toLowerCase();
      if (!bNotes.includes(fNotes)) return false;
    }
    if (filterSearch) {
      const query = filterSearch.trim().toLowerCase();
      const normQuery = normalizeText(query);
      const nameMatch = normalizeText(b.name).includes(normQuery);
      const phoneMatch = b.phone ? String(b.phone).includes(query) : false;
      const idMatch = b.id_number ? String(b.id_number).includes(query) : false;
      const codeMatch = b.code ? String(b.code).toLowerCase().includes(query) : false;
      if (!nameMatch && !phoneMatch && !idMatch && !codeMatch) return false;
    }
    return true;
  });

  const itemsPerPage = 50;
  const totalPages = Math.ceil(filteredBeneficiaries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBeneficiaries = filteredBeneficiaries.slice(startIndex, startIndex + itemsPerPage);

  // Handle Multi-Selection (Current Page only)
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const newSelected = new Set(selectedIds);
      paginatedBeneficiaries.forEach(b => newSelected.add(b.id));
      setSelectedIds(newSelected);
    } else {
      const newSelected = new Set(selectedIds);
      paginatedBeneficiaries.forEach(b => newSelected.delete(b.id));
      setSelectedIds(newSelected);
    }
  };

  const handleSelectOne = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Export Project Excel
  const handleExportProjectExcel = () => {
    if (!selectedProject) return;
    
    let url = `${window.API_BASE_URL}/api/export/beneficiaries?project_id=${selectedProject.id}`;
    
    if (selectedIds.size > 0) {
      const idsStr = Array.from(selectedIds).join(',');
      url += `&ids=${idsStr}`;
    } else if (filterDelegate || filterNotes) {
      const idsStr = filteredBeneficiaries.map(b => b.id).join(',');
      url += `&ids=${idsStr}`;
    }
    
    window.open(url);
  };

  // Print Project Cards
  const handlePrintProjectCards = () => {
    if (!selectedProject) return;
    
    let url = `${window.API_BASE_URL}/api/export/cards-print?project_id=${selectedProject.id}`;
    
    if (selectedIds.size > 0) {
      const idsStr = Array.from(selectedIds).join(',');
      url += `&ids=${idsStr}`;
    } else if (filterDelegate || filterNotes) {
      const idsStr = filteredBeneficiaries.map(b => b.id).join(',');
      url += `&ids=${idsStr}`;
    }
    
    window.open(url);
  };

  // --- RENDERING DETAIL VIEW ---
  if (selectedProject) {
    return (
      <div>
        {/* Back and Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={handleBackToProjects}>
              <ArrowRight size={18} />
              العودة للمشاريع
            </button>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{selectedProject.name}</h3>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => setIsMigrateOpen(true)}>
              <Filter size={16} />
              ترحيل من القاعدة العامة
            </button>
            <button className="btn btn-success" onClick={() => setIsAddDirectOpen(true)}>
              <Plus size={16} />
              إضافة مباشر للمشروع
            </button>
            <button className="btn btn-primary" style={{ backgroundColor: '#10b981', borderColor: '#10b981' }} onClick={handleExportProjectExcel} title="تصدير كشف المشروع لإكسل">
              <FileSpreadsheet size={16} />
              تصدير الكشف (إكسل)
            </button>
            <button className="btn btn-primary" style={{ backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' }} onClick={handlePrintProjectCards} title="طباعة بطاقات المشروع">
              <Printer size={16} />
              طباعة البطاقات
            </button>
          </div>
        </div>

        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <strong>وصف المشروع:</strong> {selectedProject.description || 'لا يوجد وصف مضاف.'}
        </p>

        {/* Filters */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          backgroundColor: 'var(--bg-secondary)',
          padding: '20px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          marginBottom: '24px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>البحث العام</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                className="form-control" 
                placeholder="الاسم، الجوال، الهوية، الكود..." 
                value={filterSearch}
                onChange={(e) => {
                  setFilterSearch(e.target.value);
                  setSelectedIds(new Set());
                  setCurrentPage(1);
                }}
                style={{ paddingRight: '40px' }} // RTL padding
              />
              <Search size={16} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>تصفية حسب المندوب</label>
            <SearchableSelect 
              value={filterDelegate}
              onChange={(val) => {
                setFilterDelegate(val);
                setSelectedIds(new Set());
                setCurrentPage(1);
              }}
              options={projectDelegates}
              placeholder="كل المندوبين"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>البحث في الملاحظات</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="اكتب للبحث في الملاحظات..." 
              value={filterNotes}
              onChange={(e) => {
                setFilterNotes(e.target.value);
                setSelectedIds(new Set());
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Selection Banner */}
        {selectedIds.size > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--primary-light)',
            color: 'var(--primary)',
            padding: '16px 24px',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '20px',
            border: '1px solid var(--primary)',
            boxShadow: 'var(--shadow-sm)',
            fontWeight: 'bold',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              تم تحديد <span style={{ fontSize: '1.1rem', color: 'var(--primary-hover)', fontWeight: 800 }}>{selectedIds.size}</span> مستفيد من الصفوف الظاهرة.
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn btn-primary" 
                style={{ padding: '6px 14px', fontSize: '0.85rem', backgroundColor: '#10b981', borderColor: '#10b981' }} 
                onClick={handleExportProjectExcel}
              >
                تصدير المحدد (إكسل)
              </button>
              <button 
                className="btn btn-primary" 
                style={{ padding: '6px 14px', fontSize: '0.85rem', backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' }} 
                onClick={handlePrintProjectCards}
              >
                طباعة بطاقات المحدد
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '6px 14px', fontSize: '0.85rem', borderColor: 'var(--primary)', color: 'var(--primary)', backgroundColor: 'transparent' }} 
                onClick={() => setSelectedIds(new Set())}
              >
                إلغاء التحديد
              </button>
            </div>
          </div>
        )}

        {/* Project Beneficiary List */}
        <h4 style={{ fontWeight: 800, marginBottom: '16px' }}>
          المستفيدين المدرجين بالمشروع ({projectBeneficiaries.length === filteredBeneficiaries.length ? projectBeneficiaries.length : `${filteredBeneficiaries.length} من ${projectBeneficiaries.length}`})
        </h4>
        <div className="table-container">
          {projectBeneficiaries.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              المشروع فارغ حالياً. اضغط على "ترحيل من القاعدة العامة" لاستيراد أسماء، أو أضف يدوياً.
            </p>
          ) : filteredBeneficiaries.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              لا توجد نتائج مطابقة لخيارات التصفية المحددة.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={paginatedBeneficiaries.length > 0 && paginatedBeneficiaries.every(b => selectedIds.has(b.id))}
                      onChange={handleSelectAll}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </th>
                  <th>كود المستفيد</th>
                  <th>الاسم الكامل</th>
                  <th>رقم الهاتف</th>
                  <th>رقم الهوية</th>
                  <th>الموقع (المحافظة/المديرية)</th>
                  <th>المندوب</th>
                  <th>الملاحظات</th>
                  <th>حالة التسليم للمشروع</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBeneficiaries.map(b => (
                  <tr key={b.id} style={selectedIds.has(b.id) ? { backgroundColor: 'var(--primary-light)' } : {}}>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(b.id)}
                        onChange={() => handleSelectOne(b.id)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </td>
                    <td>{b.code || '—'}</td>
                    <td style={{ fontWeight: 700 }}>{b.name}</td>
                    <td>{b.phone || '—'}</td>
                    <td>{b.id_number || '—'}</td>
                    <td>{b.governorate || '—'} / {b.district || '—'}</td>
                    <td>{b.delegate_name || '—'}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{b.notes || '—'}</td>
                    <td>
                      <span 
                        className={`badge ${b.project_status === 'delivered' ? 'badge-linked' : 'badge-pending'}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleToggleStatus(b.id, b.project_status)}
                        title="اضغط لتغيير الحالة"
                      >
                        {b.project_status === 'delivered' ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> تم التسليم</span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> قيد الانتظار</span>
                        )}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', color: 'var(--danger)' }} onClick={() => handleRemoveFromProject(b.id)} title="استبعاد من المشروع">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="pagination-container" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            marginTop: '16px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              عرض {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filteredBeneficiaries.length)} من {filteredBeneficiaries.length} مستفيد
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '6px 12px', minWidth: '40px', height: '40px' }} 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              >
                السابق
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1) {
                  return (
                    <button
                      key={p}
                      className="btn"
                      style={{
                        padding: '6px 12px',
                        minWidth: '40px',
                        height: '40px',
                        backgroundColor: currentPage === p ? 'var(--primary)' : 'var(--bg-tertiary)',
                        color: currentPage === p ? '#ffffff' : 'var(--text-primary)',
                        border: currentPage === p ? 'none' : '1px solid var(--border-color)'
                      }}
                      onClick={() => setCurrentPage(p)}
                    >
                      {p}
                    </button>
                  );
                } else if (p === 2 && currentPage > 3) {
                  return <span key="dots-start" style={{ color: 'var(--text-muted)' }}>...</span>;
                } else if (p === totalPages - 1 && currentPage < totalPages - 2) {
                  return <span key="dots-end" style={{ color: 'var(--text-muted)' }}>...</span>;
                }
                return null;
              })}

              <button 
                className="btn btn-secondary" 
                style={{ padding: '6px 12px', minWidth: '40px', height: '40px' }} 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              >
                التالي
              </button>
            </div>
          </div>
        )}

        {/* Migration Modal */}
        {isMigrateOpen && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '750px' }}>
              <div className="modal-header">
                <h3>ترحيل مستفيدين بالفلاتر والتحديد</h3>
                <button className="modal-close" onClick={() => {
                  setIsMigrateOpen(false);
                  setMigDelegate('');
                  setMigNotes('');
                  setMigCandidates([]);
                  setMigSelectedIds(new Set());
                }}><X size={20} /></button>
              </div>
              <form onSubmit={handleMigrate}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.6' }}>
                  قم بتصفية مستفيدي القاعدة العامة باستخدام المندوب و/أو الملاحظات لعرضهم وتحديد من ترغب في ترحيله لمشروع <strong>{selectedProject.name}</strong>.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'flex-end', marginBottom: '24px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 700 }}>المندوب</label>
                    <SearchableSelect 
                      value={migDelegate}
                      onChange={(val) => setMigDelegate(val)}
                      options={filterOptions.delegates}
                      placeholder="كل المندوبين"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 700 }}>البحث في الملاحظات</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="كلمة مفتاحية (مثل اسم المشروع)..." 
                      value={migNotes} 
                      onChange={(e) => setMigNotes(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          fetchMigrationCandidates();
                        }
                      }}
                    />
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={fetchMigrationCandidates}
                    disabled={isSearchingCandidates}
                    style={{ height: '46px' }}
                  >
                    {isSearchingCandidates ? 'جاري البحث...' : 'بحث وعرض'}
                  </button>
                </div>

                {/* Candidate List Container */}
                <div style={{ 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)', 
                  maxHeight: '320px', 
                  overflowY: 'auto', 
                  marginBottom: '24px',
                  backgroundColor: 'var(--bg-primary)'
                }}>
                  {isSearchingCandidates ? (
                    <p style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>جاري تحميل مرشحي الترحيل...</p>
                  ) : migCandidates.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      لا توجد أسماء مطابقة حالياً. اختر مندوباً أو اكتب كلمة في الملاحظات ثم اضغط "بحث وعرض".
                    </p>
                  ) : (
                    <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'var(--bg-tertiary)' }}>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={migCandidates.length > 0 && migSelectedIds.size === migCandidates.length}
                              onChange={handleSelectAllMigrate}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                          </th>
                          <th>كود</th>
                          <th>الاسم الكامل بموجب البطاقة</th>
                          <th>المندوب</th>
                          <th>الملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {migCandidates.map(c => (
                          <tr key={c.id} style={migSelectedIds.has(c.id) ? { backgroundColor: 'var(--primary-light)' } : {}}>
                            <td style={{ textAlign: 'center' }}>
                              <input 
                                type="checkbox" 
                                checked={migSelectedIds.has(c.id)}
                                onChange={() => handleSelectOneMigrate(c.id)}
                                style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                              />
                            </td>
                            <td>{c.code || '—'}</td>
                            <td style={{ fontWeight: 700 }}>{c.name}</td>
                            <td>{c.delegate_name || '—'}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{c.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setIsMigrateOpen(false);
                    setMigDelegate('');
                    setMigNotes('');
                    setMigCandidates([]);
                    setMigSelectedIds(new Set());
                  }}>إلغاء</button>
                  <button 
                    type="submit" 
                    className="btn btn-success" 
                    disabled={migSelectedIds.size === 0}
                  >
                    ترحيل الأسماء المحددة ({migSelectedIds.size})
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Direct Add Modal */}
        {isAddDirectOpen && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px' }}>
              <div className="modal-header">
                <h3>إضافة مستفيد مباشر للمشروع</h3>
                <button className="modal-close" onClick={() => setIsAddDirectOpen(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handleAddDirect}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  ملاحظة: إضافة مستفيد هنا ستحفظه في القاعدة العامة تلقائياً وتدرجه في هذا المشروع في آن واحد.
                </p>

                <div className="form-row" style={{ gridTemplateColumns: '1fr 2fr' }}>
                  <div className="form-group">
                    <label>كود المستفيد</label>
                    <input type="text" className="form-control" value={directCode} onChange={(e) => setDirectCode(e.target.value)} placeholder="كود..." />
                  </div>
                  <div className="form-group">
                    <label>الاسم الكامل (مطلوب)</label>
                    <input type="text" className="form-control" required value={directName} onChange={(e) => setDirectName(e.target.value)} placeholder="الاسم رباعي..." />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>رقم الجوال</label>
                    <input type="text" className="form-control" value={directPhone} onChange={(e) => setDirectPhone(e.target.value)} placeholder="الهاتف..." />
                  </div>
                  <div className="form-group">
                    <label>رقم الهوية</label>
                    <input type="text" className="form-control" value={directIdNum} onChange={(e) => setDirectIdNum(e.target.value)} placeholder="الهوية..." />
                  </div>
                </div>

                <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 2fr' }}>
                  <div className="form-group">
                    <label>المحافظة</label>
                    <input type="text" className="form-control" value={directGovernorate} onChange={(e) => setDirectGovernorate(e.target.value)} placeholder="المحافظة..." />
                  </div>
                  <div className="form-group">
                    <label>المديرية</label>
                    <input type="text" className="form-control" value={directDistrict} onChange={(e) => setDirectDistrict(e.target.value)} placeholder="المديرية..." />
                  </div>
                  <div className="form-group">
                    <label>المنطقة</label>
                    <input type="text" className="form-control" value={directRegion} onChange={(e) => setDirectRegion(e.target.value)} placeholder="المنطقة..." />
                  </div>
                </div>

                <div className="form-group">
                  <label>اسم المندوب</label>
                  <input type="text" className="form-control" value={directDelegate} onChange={(e) => setDirectDelegate(e.target.value)} placeholder="اسم المندوب (اختياري)..." />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsAddDirectOpen(false)}>إلغاء</button>
                  <button type="submit" className="btn btn-primary">إضافة للمشروع</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- RENDERING PROJECTS LIST VIEW ---
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>إدارة مشاريع التوزيع</h3>
          <p style={{ color: 'var(--text-muted)' }}>إنشاء وتصنيف الكشوفات حسب حملات التوزيع والجمعية</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} />
          إنشاء مشروع جديد
        </button>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>جاري تحميل المشاريع...</p>
      ) : projects.length === 0 ? (
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '40px',
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}>
          <FolderGit2 size={40} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
          <h4>لا توجد مشاريع مضافة بعد</h4>
          <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>اضغط على "إنشاء مشروع جديد" لإنشاء أول حملة توزيع وربط المستفيدين بها.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
          {projects.map(proj => (
            <div 
              key={proj.id} 
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: 'transform var(--transition-fast)'
              }}
              onClick={() => fetchProjectDetails(proj.id)}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <h4 style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>{proj.name}</h4>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '6px 10px', color: 'var(--danger)', border: 'none', background: 'none' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(proj.id);
                    }}
                    title="حذف المشروع"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px', minHeight: '40px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {proj.description || 'لا يوجد وصف.'}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  تاريخ البدء: {new Date(proj.created_at).toLocaleDateString('ar-EG')}
                </span>
                <span style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700, padding: '4px 12px', borderRadius: '15px' }}>
                  {proj.beneficiary_count} مستفيد
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {isCreateOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>إنشاء مشروع توزيع جديد</h3>
              <button className="modal-close" onClick={() => setIsCreateOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label>اسم المشروع (مطلوب)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required 
                  placeholder="مثال: توزيع سلال رمضان الغذائية..." 
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>وصف المشروع</label>
                <textarea 
                  className="form-control" 
                  rows="3" 
                  placeholder="اكتب أهداف التوزيع، النطاق الجغرافي والممول..." 
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>إلغاء</button>
                <button type="submit" className="btn btn-primary">تأكيد الإنشاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
