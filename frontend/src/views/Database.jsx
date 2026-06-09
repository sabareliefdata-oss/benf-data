import React, { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, FileSpreadsheet, Eye, Trash2, Edit2, X, AlertTriangle, Smartphone, CreditCard, User, MapPin, Printer, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

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
    <div className="searchable-select-container" ref={containerRef}>
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

export default function Database({ activeTab, triggerExcelUploadFlag, resetImportFlag, isAdmin = true }) {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters state
  const [search, setSearch] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [district, setDistrict] = useState('');
  const [region, setRegion] = useState('');
  const [delegate, setDelegate] = useState('');
  const [cardStatus, setCardStatus] = useState('');
  
  // Filter options loaded from database
  const [filterOptions, setFilterOptions] = useState({ governorates: [], districts: [], regions: [], delegates: [] });

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selection State
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Drawer (View details) state
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [projectsHistory, setProjectsHistory] = useState([]);
  const [loadingProjectsHistory, setLoadingProjectsHistory] = useState(false);

  useEffect(() => {
    if (selectedBeneficiary) {
      setLoadingProjectsHistory(true);
      fetch(`${window.API_BASE_URL}/api/beneficiaries/${selectedBeneficiary.id}/projects`)
        .then(res => res.json())
        .then(data => {
          setProjectsHistory(data || []);
        })
        .catch(err => {
          console.error("Error fetching project history", err);
          setProjectsHistory([]);
        })
        .finally(() => {
          setLoadingProjectsHistory(false);
        });
    } else {
      setProjectsHistory([]);
    }
  }, [selectedBeneficiary]);
  
  // Add/Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('add'); // 'add' or 'edit'
  const [editingId, setEditingId] = useState(null);
  
  // Form fields (26 custom survey fields)
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formGender, setFormGender] = useState('');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formMaritalStatus, setFormMaritalStatus] = useState('');
  const [formIdType, setFormIdType] = useState('');
  const [formIdNumber, setFormIdNumber] = useState('');
  const [formOccupation, setFormOccupation] = useState('');
  const [formPartnerName, setFormPartnerName] = useState('');
  const [formPartnerGender, setFormPartnerGender] = useState('');
  const [formPartnerIdType, setFormPartnerIdType] = useState('');
  const [formPartnerIdNumber, setFormPartnerIdNumber] = useState('');
  const [formFamilyStatus, setFormFamilyStatus] = useState('');
  const [formGovernorate, setFormGovernorate] = useState('');
  const [formDistrict, setFormDistrict] = useState('');
  const [formRegion, setFormRegion] = useState('');
  const [formChildrenCount, setFormChildrenCount] = useState(0);
  const [formAdultsCount, setFormAdultsCount] = useState(0);
  const [formElderlyCount, setFormElderlyCount] = useState(0);
  const [formTotalFamilyCount, setFormTotalFamilyCount] = useState(0);
  const [formPhone, setFormPhone] = useState('');
  const [formBackupPhone, setFormBackupPhone] = useState('');
  const [formDelegateName, setFormDelegateName] = useState('');
  const [formDelegatePhone, setFormDelegatePhone] = useState('');
  const [formSurveyArea, setFormSurveyArea] = useState('');
  const [formNotes, setFormNotes] = useState('');
  
  // Duplicate check warning
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const limit = 50;

  // Fetch list and filters
  const fetchData = async (targetPage = page) => {
    setLoading(true);
    try {
      const offset = (targetPage - 1) * limit;
      const q = new URLSearchParams({
        search,
        governorate,
        district,
        region,
        delegate,
        card_status: cardStatus,
        limit: limit.toString(),
        offset: offset.toString()
      });
      const res = await fetch(`${window.API_BASE_URL}/api/beneficiaries?${q.toString()}`);
      const data = await res.json();
      setBeneficiaries(data);

      const totalHeader = res.headers.get('X-Total-Count');
      if (totalHeader !== null) {
        setTotalCount(parseInt(totalHeader, 10));
      } else {
        setTotalCount(data.length);
      }

      const resFilters = await fetch(`${window.API_BASE_URL}/api/filters-data`);
      const filters = await resFilters.json();
      setFilterOptions(filters);
    } catch (error) {
      console.error("Failed fetching beneficiaries", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle filter changes (Reset page to 1)
  useEffect(() => {
    if (page === 1) {
      fetchData(1);
    } else {
      setPage(1);
    }
    setSelectedIds(new Set()); // clear manual selections on filter change
  }, [search, governorate, district, region, delegate, cardStatus]);

  // Handle page changes
  useEffect(() => {
    fetchData(page);
  }, [page]);

  // Handle Excel upload trigger from parent
  useEffect(() => {
    if (triggerExcelUploadFlag) {
      fetchData(page);
      resetImportFlag();
    }
  }, [triggerExcelUploadFlag]);

  // Live duplicate checking
  useEffect(() => {
    if (!formName && !formPhone && !formIdNumber) {
      setDuplicateWarning(null);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`${window.API_BASE_URL}/api/beneficiaries/check-duplicate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            phone: formPhone,
            id_number: formIdNumber,
            excludeId: editingId
          })
        });
        const data = await res.json();
        if (data.duplicate) {
          setDuplicateWarning(data.duplicate);
        } else {
          setDuplicateWarning(null);
        }
      } catch (error) {
        console.error("Duplicate checking error", error);
      }
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [formName, formPhone, formIdNumber, editingId]);

  // Open Modal
  const openModal = (type, item = null) => {
    setModalType(type);
    setDuplicateWarning(null);
    if (type === 'edit' && item) {
      setEditingId(item.id);
      setFormCode(item.code || '');
      setFormName(item.name || '');
      setFormGender(item.gender || '');
      setFormBirthDate(item.birth_date || '');
      setFormMaritalStatus(item.marital_status || '');
      setFormIdType(item.id_type || '');
      setFormIdNumber(item.id_number || '');
      setFormOccupation(item.occupation || '');
      setFormPartnerName(item.partner_name || '');
      setFormPartnerGender(item.partner_gender || '');
      setFormPartnerIdType(item.partner_id_type || '');
      setFormPartnerIdNumber(item.partner_id_number || '');
      setFormFamilyStatus(item.family_status || '');
      setFormGovernorate(item.governorate || '');
      setFormDistrict(item.district || '');
      setFormRegion(item.region || '');
      setFormChildrenCount(item.children_count || 0);
      setFormAdultsCount(item.adults_count || 0);
      setFormElderlyCount(item.elderly_count || 0);
      setFormTotalFamilyCount(item.total_family_count || 0);
      setFormPhone(item.phone || '');
      setFormBackupPhone(item.backup_phone || '');
      setFormDelegateName(item.delegate_name || '');
      setFormDelegatePhone(item.delegate_phone || '');
      setFormSurveyArea(item.survey_area || '');
      setFormNotes(item.notes || '');
    } else {
      setEditingId(null);
      setFormCode('');
      setFormName('');
      setFormGender('');
      setFormBirthDate('');
      setFormMaritalStatus('');
      setFormIdType('');
      setFormIdNumber('');
      setFormOccupation('');
      setFormPartnerName('');
      setFormPartnerGender('');
      setFormPartnerIdType('');
      setFormPartnerIdNumber('');
      setFormFamilyStatus('');
      setFormGovernorate('');
      setFormDistrict('');
      setFormRegion('');
      setFormChildrenCount(0);
      setFormAdultsCount(0);
      setFormElderlyCount(0);
      setFormTotalFamilyCount(0);
      setFormPhone('');
      setFormBackupPhone('');
      setFormDelegateName('');
      setFormDelegatePhone('');
      setFormSurveyArea('');
      setFormNotes('');
    }
    setIsModalOpen(true);
  };

  // Close Modal
  const closeModal = () => {
    setIsModalOpen(false);
    setDuplicateWarning(null);
  };

  // Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName) return;

    const payload = {
      code: formCode,
      name: formName,
      gender: formGender,
      birth_date: formBirthDate,
      marital_status: formMaritalStatus,
      id_type: formIdType,
      id_number: formIdNumber,
      occupation: formOccupation,
      partner_name: formPartnerName,
      partner_gender: formPartnerGender,
      partner_id_type: formPartnerIdType,
      partner_id_number: formPartnerIdNumber,
      family_status: formFamilyStatus,
      governorate: formGovernorate,
      district: formDistrict,
      region: formRegion,
      children_count: parseInt(formChildrenCount) || 0,
      adults_count: parseInt(formAdultsCount) || 0,
      elderly_count: parseInt(formElderlyCount) || 0,
      total_family_count: parseInt(formTotalFamilyCount) || 0,
      phone: formPhone,
      backup_phone: formBackupPhone,
      delegate_name: formDelegateName,
      delegate_phone: formDelegatePhone,
      survey_area: formSurveyArea,
      notes: formNotes
    };

    if (modalType === 'edit') {
      payload.card_status = selectedBeneficiary?.id === editingId ? selectedBeneficiary.card_status : undefined;
    }

    const url = modalType === 'add' 
      ? `${window.API_BASE_URL}/api/beneficiaries` 
      : `${window.API_BASE_URL}/api/beneficiaries/${editingId}`;
    
    const method = modalType === 'add' ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        closeModal();
        fetchData();
        if (selectedBeneficiary && selectedBeneficiary.id === editingId) {
          const updatedRes = await fetch(`${window.API_BASE_URL}/api/beneficiaries/${editingId}`);
          const updatedData = await updatedRes.json();
          setSelectedBeneficiary(updatedData);
        }
      } else {
        const errorData = await res.json();
        alert(`خطأ: ${errorData.error || 'حدث خطأ أثناء حفظ البيانات'}`);
      }
    } catch (e) {
      console.error(e);
      alert('فشل الاتصال بالسيرفر');
    }
  };

  // Delete Beneficiary
  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستفيد تماماً من النظام؟ سيتم حذف صور بطاقته أيضاً.')) return;
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/beneficiaries/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedBeneficiary(null);
        fetchData();
      } else {
        alert('فشل الحذف');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Unlink Card Image only
  const handleUnlinkCard = async (item) => {
    if (!confirm('هل أنت متأكد من إلغاء ربط بطاقة هذا المستفيد؟')) return;
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/beneficiaries/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          card_status: 'pending' // Reset card status
        })
      });
      if (res.ok) {
        const updatedRes = await fetch(`${window.API_BASE_URL}/api/beneficiaries/${item.id}`);
        const updatedData = await updatedRes.json();
        setSelectedBeneficiary(updatedData);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Export Filtered or Selected to Excel
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
    }
    window.open(`${window.API_BASE_URL}/api/export/beneficiaries?${params.toString()}`);
  };

  // Handle Bulk Printing Cards to PDF
  const handlePrintCards = () => {
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
    }
    window.open(`${window.API_BASE_URL}/api/export/cards-print?${params.toString()}`, '_blank');
  };

  // Checkbox Handlers
  const handleSelectToggle = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllToggle = () => {
    const shownIds = beneficiaries.map(b => b.id);
    const allShownSelected = shownIds.every(id => selectedIds.has(id));
    
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allShownSelected) {
        shownIds.forEach(id => next.delete(id));
      } else {
        shownIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  return (
    <div>
      {/* Action header bar */}
      <div className="table-actions">
        <div className="search-box">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="البحث بالاسم، الكود، الهاتف، أو رقم الهوية..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <SearchableSelect 
            value={governorate} 
            onChange={setGovernorate} 
            options={filterOptions.governorates} 
            placeholder="كل المحافظات" 
          />

          <SearchableSelect 
            value={district} 
            onChange={setDistrict} 
            options={filterOptions.districts} 
            placeholder="كل المديريات" 
          />

          <SearchableSelect 
            value={region} 
            onChange={setRegion} 
            options={filterOptions.regions} 
            placeholder="كل المناطق" 
          />

          <SearchableSelect 
            value={delegate} 
            onChange={setDelegate} 
            options={filterOptions.delegates} 
            placeholder="كل المندوبين" 
          />

          <select className="filter-select" value={cardStatus} onChange={(e) => setCardStatus(e.target.value)}>
            <option value="">حالة البطاقة (الكل)</option>
            <option value="linked">مربوطة</option>
            <option value="pending">معلقة</option>
            <option value="missing">مفقودة</option>
          </select>

          <button className="btn btn-secondary" onClick={handlePrintCards} title="طباعة بطاقات المستفيدين كـ PDF">
            <Printer size={16} />
            طباعة البطائق
          </button>

          <button className="btn btn-secondary" onClick={handleExportExcel} title="تصدير الكشف المصفى لإكسل">
            <FileSpreadsheet size={16} />
            تصدير
          </button>

          {isAdmin && (
            <button className="btn btn-primary" onClick={() => openModal('add')}>
              <UserPlus size={16} />
              إضافة مستفيد
            </button>
          )}
        </div>
      </div>

      {/* Selection Banner */}
      {selectedIds.size > 0 && (
        <div style={{
          backgroundColor: 'var(--primary-light)',
          border: '1px solid var(--primary)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 24px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'fadeIn var(--transition-fast)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
              تم تحديد {selectedIds.size} مستفيد للعمليات الجماعية
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={handlePrintCards} style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
              <Printer size={14} />
              طباعة بطاقات المحددين ({selectedIds.size})
            </button>
            <button className="btn btn-success" onClick={handleExportExcel} style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
              <FileSpreadsheet size={14} />
              تصدير إكسل للمحددين ({selectedIds.size})
            </button>
            <button className="btn btn-secondary" onClick={() => setSelectedIds(new Set())} style={{ padding: '6px 14px', fontSize: '0.85rem', backgroundColor: 'var(--bg-secondary)' }}>
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>جاري تحميل البيانات...</div>
        ) : beneficiaries.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>لا يوجد نتائج مطابقة للبحث.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={beneficiaries.length > 0 && beneficiaries.every(b => selectedIds.has(b.id))}
                    onChange={handleSelectAllToggle}
                    style={{ cursor: 'pointer', width: '18px', height: '18px', verticalAlign: 'middle' }}
                  />
                </th>
                <th>كود المستفيد</th>
                <th>الاسم بموجب الهوية</th>
                <th>رقم الهاتف</th>
                <th>رقم الهوية</th>
                <th>الموقع (المحافظة/المديرية)</th>
                <th>المندوب</th>
                <th>حالة البطاقة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {beneficiaries.map(item => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <tr key={item.id} className={isSelected ? 'selected' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => handleSelectToggle(item.id)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px', verticalAlign: 'middle' }}
                      />
                    </td>
                    <td>{item.code || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ fontWeight: 700 }}>{item.name}</td>
                    <td>{item.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>{item.id_number || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>{item.governorate || '—'} / {item.district || '—'}</td>
                    <td>{item.delegate_name || '—'}</td>
                    <td>
                      <span className={`badge badge-${item.card_status}`}>
                        {item.card_status === 'linked' ? 'مربوطة' : item.card_status === 'missing' ? 'مفقودة' : 'معلقة'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setSelectedBeneficiary(item)} title="عرض التفاصيل">
                          <Eye size={14} />
                        </button>
                        {isAdmin && (
                          <>
                            <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => openModal('edit', item)} title="تعديل">
                              <Edit2 size={14} />
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '6px 12px', color: 'var(--danger)' }} onClick={() => handleDelete(item.id)} title="حذف">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Controls */}
      {!loading && totalCount > limit && (
        <div className="pagination-container">
          <div className="pagination-info">
            يظهر <strong>{beneficiaries.length}</strong> من إجمالي <strong>{totalCount}</strong> مستفيد
          </div>
          
          <div className="pagination-pages">
            <button 
              className="pagination-btn" 
              onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              disabled={page === 1}
              title="الصفحة السابقة"
              type="button"
            >
              <ChevronRight size={18} />
            </button>
            
            {(() => {
              const totalPages = Math.ceil(totalCount / limit);
              const pages = [];
              const startPage = Math.max(1, page - 2);
              const endPage = Math.min(totalPages, startPage + 4);
              
              if (startPage > 1) {
                pages.push(
                  <button 
                    key={1} 
                    className={`pagination-btn ${page === 1 ? 'active' : ''}`}
                    onClick={() => setPage(1)}
                    type="button"
                  >
                    1
                  </button>
                );
                if (startPage > 2) {
                  pages.push(<span key="ell-1" style={{ color: 'var(--text-muted)', margin: '0 4px' }}>...</span>);
                }
              }
              
              for (let i = startPage; i <= endPage; i++) {
                if (i === 1 && startPage > 1) continue;
                pages.push(
                  <button 
                    key={i} 
                    className={`pagination-btn ${page === i ? 'active' : ''}`}
                    onClick={() => setPage(i)}
                    type="button"
                  >
                    {i}
                  </button>
                );
              }
              
              if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                  pages.push(<span key="ell-2" style={{ color: 'var(--text-muted)', margin: '0 4px' }}>...</span>);
                }
                pages.push(
                  <button 
                    key={totalPages} 
                    className={`pagination-btn ${page === totalPages ? 'active' : ''}`}
                    onClick={() => setPage(totalPages)}
                    type="button"
                  >
                    {totalPages}
                  </button>
                );
              }
              
              return pages;
            })()}
            
            <button 
              className="pagination-btn" 
              onClick={() => setPage(prev => Math.min(prev + 1, Math.ceil(totalCount / limit)))}
              disabled={page === Math.ceil(totalCount / limit)}
              title="الصفحة التالية"
              type="button"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Details Side Drawer */}
      {selectedBeneficiary && (
        <div className="drawer-overlay" onClick={() => setSelectedBeneficiary(null)}>
          <div className="drawer-content" style={{ width: '550px' }} onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3 style={{ fontWeight: 800 }}>تفاصيل المستفيد الكاملة</h3>
              <button className="modal-close" onClick={() => setSelectedBeneficiary(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="drawer-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
                
                {/* 1. Personal Info */}
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>البيانات الأساسية للمستفيد</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem' }}>
                    <div><strong>كود المستفيد:</strong> {selectedBeneficiary.code || '—'}</div>
                    <div><strong>الاسم الكامل:</strong> {selectedBeneficiary.name}</div>
                    <div><strong>الجنس:</strong> {selectedBeneficiary.gender || '—'}</div>
                    <div><strong>تاريخ الميلاد:</strong> {selectedBeneficiary.birth_date || '—'}</div>
                    <div><strong>الحالة الاجتماعية:</strong> {selectedBeneficiary.marital_status || '—'}</div>
                    <div><strong>المهنة:</strong> {selectedBeneficiary.occupation || '—'}</div>
                    <div><strong>حالة الأسرة:</strong> {selectedBeneficiary.family_status || '—'}</div>
                  </div>
                </div>

                {/* 2. Contact & IDs */}
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>بيانات الاتصال والهوية</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem' }}>
                    <div><strong>رقم الجوال:</strong> {selectedBeneficiary.phone || '—'}</div>
                    <div><strong>الجوال الاحتياطي:</strong> {selectedBeneficiary.backup_phone || '—'}</div>
                    <div><strong>نوع الهوية:</strong> {selectedBeneficiary.id_type || '—'}</div>
                    <div><strong>رقم الهوية:</strong> {selectedBeneficiary.id_number || '—'}</div>
                  </div>
                </div>

                {/* 3. Partner details */}
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>بيانات الشريك (الزوج / الزوجة)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem' }}>
                    <div style={{ gridColumn: 'span 2' }}><strong>اسم الشريك:</strong> {selectedBeneficiary.partner_name || '—'}</div>
                    <div><strong>جنس الشريك:</strong> {selectedBeneficiary.partner_gender || '—'}</div>
                    <div><strong>نوع هوية الشريك:</strong> {selectedBeneficiary.partner_id_type || '—'}</div>
                    <div style={{ gridColumn: 'span 2' }}><strong>رقم هوية الشريك:</strong> {selectedBeneficiary.partner_id_number || '—'}</div>
                  </div>
                </div>

                {/* 4. Geography and Family counts */}
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>تفاصيل العنوان وأفراد الأسرة</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem', marginBottom: '12px' }}>
                    <div><strong>المحافظة:</strong> {selectedBeneficiary.governorate || '—'}</div>
                    <div><strong>المديرية:</strong> {selectedBeneficiary.district || '—'}</div>
                    <div style={{ gridColumn: 'span 2' }}><strong>المنطقة / القرية:</strong> {selectedBeneficiary.region || '—'}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '10px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '12px' }}>
                    <div><strong>أطفال 1-18</strong><div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>{selectedBeneficiary.children_count || 0}</div></div>
                    <div><strong>بالغين 18-59</strong><div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>{selectedBeneficiary.adults_count || 0}</div></div>
                    <div><strong>كبار +60</strong><div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>{selectedBeneficiary.elderly_count || 0}</div></div>
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, textAlign: 'center', padding: '8px', border: '1px dashed var(--primary)', borderRadius: 'var(--radius-sm)' }}>
                    إجمالي عدد أفراد الأسرة (المسجل): <span style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>{selectedBeneficiary.total_family_count || 0}</span>
                  </div>
                </div>

                {/* 5. Survey and Delegate */}
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>بيانات المسح والميدان</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem' }}>
                    <div><strong>اسم المندوب:</strong> {selectedBeneficiary.delegate_name || '—'}</div>
                    <div><strong>جوال المندوب:</strong> {selectedBeneficiary.delegate_phone || '—'}</div>
                    <div style={{ gridColumn: 'span 2' }}><strong>منطقة المسح الميداني:</strong> {selectedBeneficiary.survey_area || '—'}</div>
                  </div>
                </div>

                {/* 6. Projects History */}
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>المشاريع المشارك بها</h4>
                  {loadingProjectsHistory ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>جاري تحميل المشاريع...</p>
                  ) : projectsHistory.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>لم يشارك هذا المستفيد في أي مشاريع حتى الآن.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {projectsHistory.map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '8px 12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <strong>{p.name}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(p.created_at).toLocaleDateString('ar-YE', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedBeneficiary.notes && (
                  <div>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>ملاحظات المندوب</h4>
                    <p style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                      {selectedBeneficiary.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Card Photo section */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>صورة البطاقة التعريفية</h4>
                {selectedBeneficiary.card_status === 'linked' && selectedBeneficiary.card_image_path ? (
                  <div>
                    <div className="card-preview-box">
                      <img 
                        src={`${window.API_BASE_URL}${selectedBeneficiary.card_image_path}`} 
                        alt="بطاقة المستفيد" 
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                      <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => window.open(`${window.API_BASE_URL}${selectedBeneficiary.card_image_path}`)}>
                        فتح الحجم الكامل
                      </button>
                      {isAdmin && (
                        <button className="btn btn-danger" onClick={() => handleUnlinkCard(selectedBeneficiary)}>
                          إلغاء ربط البطاقة
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="card-preview-box">
                    <p>لا توجد بطاقة مربوطة حالياً لهذا المستفيد.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 800 }}>{modalType === 'add' ? 'إضافة مستفيد جديد' : 'تعديل بيانات المستفيد'}</h3>
              <button className="modal-close" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Segment 1: Personal */}
                <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                  <legend style={{ padding: '0 8px', fontWeight: 800, color: 'var(--primary)' }}>البيانات الأساسية للمستفيد</legend>
                  
                  <div className="form-row" style={{ gridTemplateColumns: '1fr 2fr' }}>
                    <div className="form-group">
                      <label>كود المستفيد (اتركه فارغاً للتوليد التلقائي)</label>
                      <input type="text" className="form-control" value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="الكود..." />
                    </div>
                    <div className="form-group">
                      <label>اسم المستفيد بموجب البطاقة (مطلوب)</label>
                      <input type="text" className="form-control" required value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="الاسم الكامل رباعياً..." />
                    </div>
                  </div>

                  <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <div className="form-group">
                      <label>الجنس</label>
                      <select className="form-control" value={formGender} onChange={(e) => setFormGender(e.target.value)}>
                        <option value="">اختر...</option>
                        <option value="ذكر">ذكر</option>
                        <option value="أنثى">أنثى</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>تاريخ الميلاد</label>
                      <input type="text" className="form-control" value={formBirthDate} onChange={(e) => setFormBirthDate(e.target.value)} placeholder="سنة الميلاد..." />
                    </div>
                    <div className="form-group">
                      <label>الحالة الاجتماعية</label>
                      <input type="text" className="form-control" value={formMaritalStatus} onChange={(e) => setFormMaritalStatus(e.target.value)} placeholder="متزوج، أعزب..." />
                    </div>
                  </div>

                  <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 2fr' }}>
                    <div className="form-group">
                      <label>المهنة</label>
                      <input type="text" className="form-control" value={formOccupation} onChange={(e) => setFormOccupation(e.target.value)} placeholder="المهنة الحالية..." />
                    </div>
                    <div className="form-group">
                      <label>نوع الهوية التعريفية</label>
                      <input type="text" className="form-control" value={formIdType} onChange={(e) => setFormIdType(e.target.value)} placeholder="نوع الهوية..." />
                    </div>
                    <div className="form-group">
                      <label>رقم الهوية التعريفية</label>
                      <input type="text" className="form-control" value={formIdNumber} onChange={(e) => setFormIdNumber(e.target.value)} placeholder="الرقم الوطني للمستفيد..." />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>رقم جوال المستفيد</label>
                      <input type="text" className="form-control" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="الهاتف..." />
                    </div>
                    <div className="form-group">
                      <label>رقم الجوال الاحتياطي</label>
                      <input type="text" className="form-control" value={formBackupPhone} onChange={(e) => setFormBackupPhone(e.target.value)} placeholder="هاتف آخر..." />
                    </div>
                  </div>
                </fieldset>

                {/* DUPLICATE WARNING BOX */}
                {duplicateWarning && (
                  <div style={{
                    backgroundColor: 'var(--danger-light)',
                    border: '1px solid var(--danger)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    color: 'var(--text-primary)'
                  }}>
                    <AlertTriangle style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '2px' }} size={20} />
                    <div>
                      <h5 style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: '4px' }}>تنبيه تكرار محتمل!</h5>
                      <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>البيانات المدخلة تتطابق مع مستفيد مسجل بالفعل:</p>
                      <div style={{ backgroundColor: 'rgba(255,255,255,0.4)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                        <div><strong>الاسم:</strong> {duplicateWarning.record.name} (كود: {duplicateWarning.record.code || 'بدون'})</div>
                        {duplicateWarning.record.phone && <div><strong>الهاتف:</strong> {duplicateWarning.record.phone}</div>}
                        {duplicateWarning.record.id_number && <div><strong>الهوية:</strong> {duplicateWarning.record.id_number}</div>}
                        <div style={{ color: 'var(--text-secondary)' }}><strong>سبب التنبيه:</strong> تطابق {duplicateWarning.type === 'name' ? 'الاسم ذكياً' : duplicateWarning.type === 'phone' ? 'رقم الهاتف' : 'رقم الهوية'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Segment 2: Partner */}
                <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                  <legend style={{ padding: '0 8px', fontWeight: 800, color: 'var(--primary)' }}>بيانات الشريك (الزوج / الزوجة)</legend>
                  
                  <div className="form-group">
                    <label>اسم الشريك بالكامل</label>
                    <input type="text" className="form-control" value={formPartnerName} onChange={(e) => setFormPartnerName(e.target.value)} placeholder="اسم الزوج أو الزوجة..." />
                  </div>

                  <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 2fr' }}>
                    <div className="form-group">
                      <label>جنس الشريك</label>
                      <select className="form-control" value={formPartnerGender} onChange={(e) => setFormPartnerGender(e.target.value)}>
                        <option value="">اختر...</option>
                        <option value="ذكر">ذكر</option>
                        <option value="أنثى">أنثى</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>نوع الهوية للشريك</label>
                      <input type="text" className="form-control" value={formPartnerIdType} onChange={(e) => setFormPartnerIdType(e.target.value)} placeholder="نوع الهوية للشريك..." />
                    </div>
                    <div className="form-group">
                      <label>رقم هوية الشريك</label>
                      <input type="text" className="form-control" value={formPartnerIdNumber} onChange={(e) => setFormPartnerIdNumber(e.target.value)} placeholder="رقم الهوية للشريك..." />
                    </div>
                  </div>
                </fieldset>

                {/* Segment 3: Address & Family stats */}
                <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                  <legend style={{ padding: '0 8px', fontWeight: 800, color: 'var(--primary)' }}>بيانات السكن وأفراد الأسرة</legend>
                  
                  <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 2fr' }}>
                    <div className="form-group">
                      <label>المحافظة</label>
                      <input type="text" className="form-control" value={formGovernorate} onChange={(e) => setFormGovernorate(e.target.value)} placeholder="المحافظة..." />
                    </div>
                    <div className="form-group">
                      <label>المديرية</label>
                      <input type="text" className="form-control" value={formDistrict} onChange={(e) => setFormDistrict(e.target.value)} placeholder="المديرية..." />
                    </div>
                    <div className="form-group">
                      <label>المنطقة / القرية</label>
                      <input type="text" className="form-control" value={formRegion} onChange={(e) => setFormRegion(e.target.value)} placeholder="المنطقة..." />
                    </div>
                  </div>

                  <div className="form-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                    <div className="form-group">
                      <label>حالة الأسرة</label>
                      <input type="text" className="form-control" value={formFamilyStatus} onChange={(e) => setFormFamilyStatus(e.target.value)} placeholder="فقير، معاق، أرملة..." />
                    </div>
                    <div className="form-group">
                      <label>أطفال (1-18)</label>
                      <input type="number" className="form-control" min="0" value={formChildrenCount} onChange={(e) => setFormChildrenCount(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>بالغين (18-59)</label>
                      <input type="number" className="form-control" min="0" value={formAdultsCount} onChange={(e) => setFormAdultsCount(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>كبار سن (+60)</label>
                      <input type="number" className="form-control" min="0" value={formElderlyCount} onChange={(e) => setFormElderlyCount(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>إجمالي أفراد الأسرة</label>
                      <input type="number" className="form-control" min="0" value={formTotalFamilyCount} onChange={(e) => setFormTotalFamilyCount(e.target.value)} />
                    </div>
                  </div>
                </fieldset>

                {/* Segment 4: Delegate Info */}
                <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                  <legend style={{ padding: '0 8px', fontWeight: 800, color: 'var(--primary)' }}>بيانات المسح والمندوب</legend>
                  
                  <div className="form-row" style={{ gridTemplateColumns: '2fr 2fr 3fr' }}>
                    <div className="form-group">
                      <label>اسم المندوب</label>
                      <input type="text" className="form-control" value={formDelegateName} onChange={(e) => setFormDelegateName(e.target.value)} placeholder="المندوب الجامع للبيانات..." />
                    </div>
                    <div className="form-group">
                      <label>رقم جوال المندوب</label>
                      <input type="text" className="form-control" value={formDelegatePhone} onChange={(e) => setFormDelegatePhone(e.target.value)} placeholder="جوال المندوب..." />
                    </div>
                    <div className="form-group">
                      <label>منطقة المسح الميداني</label>
                      <input type="text" className="form-control" value={formSurveyArea} onChange={(e) => setFormSurveyArea(e.target.value)} placeholder="موقع النزول الميداني..." />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>ملاحظات إضافية</label>
                    <textarea className="form-control" rows="2" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="ملاحظات المندوب..." />
                  </div>
                </fieldset>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>إلغاء</button>
                <button type="submit" className="btn btn-primary">حفظ المستفيد</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
