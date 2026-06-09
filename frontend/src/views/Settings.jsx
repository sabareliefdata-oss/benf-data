import React, { useState, useEffect } from 'react';
import { Users2, UserPlus, Shield, Key, Edit2, Trash2, Check, RefreshCw, X, AlertTriangle } from 'lucide-react';

export default function Settings() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('add'); // 'add' or 'edit'
  const [editingUserId, setEditingUserId] = useState(null);
  
  // Form States
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('viewer');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // General Settings States
  const [sysFullName, setSysFullName] = useState(localStorage.getItem('systemName') || 'بوابة المستفيدين والربط الذكي');
  const [sysSidebarTitle, setSysSidebarTitle] = useState(localStorage.getItem('sidebarTitle') || 'بوابة المستفيدين');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    if (!sysFullName.trim() || !sysSidebarTitle.trim()) {
      setSettingsError("الرجاء إدخال اسم النظام وعنوان الشريط الجانبي.");
      return;
    }

    setSettingsLoading(true);
    setSettingsError('');
    setSettingsSuccess(false);

    try {
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);

        const uploadRes = await fetch(`${window.API_BASE_URL}/api/maintenance/upload-logo`, {
          method: 'POST',
          body: formData
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || "فشل رفع شعار النظام.");
        }
        
        localStorage.setItem('logo_timestamp', Date.now().toString());
      }

      localStorage.setItem('systemName', sysFullName.trim());
      localStorage.setItem('sidebarTitle', sysSidebarTitle.trim());

      setSettingsSuccess(true);

      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {
      console.error(err);
      setSettingsError(err.message || "حدث خطأ أثناء حفظ إعدادات النظام.");
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data || []);
      }
    } catch (e) {
      console.error("Failed to fetch users", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openAddModal = () => {
    setModalType('add');
    setEditingUserId(null);
    setFormName('');
    setFormPassword('');
    setFormRole('viewer');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setModalType('edit');
    setEditingUserId(user.id);
    setFormName(user.name);
    setFormPassword(user.password);
    setFormRole(user.role);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formPassword.trim()) {
      setFormError("الرجاء ملء حقول الاسم وكلمة المرور.");
      return;
    }

    setFormLoading(true);
    setFormError('');
    try {
      const url = modalType === 'add' 
        ? `${window.API_BASE_URL}/api/users` 
        : `${window.API_BASE_URL}/api/users/${editingUserId}`;
      
      const method = modalType === 'add' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          password: formPassword.trim(),
          role: formRole
        })
      });

      const data = await res.json();
      if (res.ok) {
        setIsModalOpen(false);
        fetchUsers();
        // If current user modified their own settings, we can notify or let it reload
      } else {
        setFormError(data.error || "حدث خطأ أثناء حفظ التغييرات.");
      }
    } catch (err) {
      console.error(err);
      setFormError("فشل الاتصال بالسيرفر لحفظ البيانات.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (user) => {
    // Basic warnings
    const loggedInUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (loggedInUser.id === user.id) {
      alert("لا يمكنك حذف حسابك الذي قمت بتسجيل الدخول به حالياً.");
      return;
    }

    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف حساب المستخدم "${user.name}" نهائياً؟`)) {
      return;
    }

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/users/${user.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        fetchUsers();
      } else {
        alert(data.error || "فشل حذف المستخدم.");
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء محاولة الاتصال بالسيرفر لحذف المستخدم.");
    }
  };

  return (
    <div style={{ padding: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-secondary)' }}>إعدادات النظام وإدارة الصلاحيات</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>إضافة وإدارة مستخدمي النظام بكلمات مرور وصلاحيات مخصصة (مدير أو متصفح)</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <UserPlus size={16} />
          إضافة مستخدم جديد
        </button>
      </div>

      {/* Users Table */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--primary)' }}>
          <Users2 size={20} />
          <h4 style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>مستخدمو النظام الحاليون</h4>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>جاري تحميل المستخدمين...</p>
        ) : users.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>لا يوجد مستخدمون بالنظام.</p>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 16px' }}>اسم المستخدم</th>
                  <th style={{ padding: '12px 16px' }}>كلمة المرور</th>
                  <th style={{ padding: '12px 16px' }}>الدور والترخيص</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>العمليات</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const loggedInUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                  const isCurrent = loggedInUser.id === user.id;

                  return (
                    <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }} className="table-row-hover">
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {user.name}
                          {isCurrent && (
                            <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                              أنت حالياً
                            </span>
                          )}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.95rem' }}>{user.password}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          fontSize: '0.8rem', 
                          padding: '4px 10px', 
                          borderRadius: '20px', 
                          fontWeight: 600,
                          backgroundColor: user.role === 'admin' ? 'var(--success-light)' : 'var(--bg-tertiary)',
                          color: user.role === 'admin' ? 'var(--success)' : 'var(--text-secondary)'
                        }}>
                          <Shield size={12} />
                          {user.role === 'admin' ? 'مدير النظام' : 'متصفح فقط'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => openEditModal(user)}
                            title="تعديل المستخدم"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => handleDeleteUser(user)}
                            disabled={isCurrent}
                            title={isCurrent ? "لا يمكنك حذف حسابك الحالي" : "حذف المستخدم"}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* General Settings Section */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        boxShadow: 'var(--shadow-sm)',
        marginTop: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--primary)' }}>
          <RefreshCw size={20} />
          <h4 style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>الإعدادات العامة وهوية النظام</h4>
        </div>

        <form onSubmit={handleSettingsSubmit}>
          {settingsError && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>{settingsError}</span>
            </div>
          )}

          {settingsSuccess && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', color: 'var(--success)', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={16} />
              <span>تم حفظ إعدادات النظام بنجاح، جاري إعادة تحميل الصفحة لتحديث التغييرات...</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>اسم النظام الكامل (يظهر في السبلاش وشاشة الدخول):</label>
              <input 
                type="text" 
                className="form-control"
                value={sysFullName}
                onChange={(e) => setSysFullName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>عنوان الشريط الجانبي (Sidebar Title):</label>
              <input 
                type="text" 
                className="form-control"
                value={sysSidebarTitle}
                onChange={(e) => setSysSidebarTitle(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '10px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>شعار المؤسسة (PNG / JPG):</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <input 
                type="file" 
                accept=".png,.jpg,.jpeg" 
                className="form-control"
                onChange={handleLogoChange}
                style={{ flex: 1 }}
              />
              
              {(logoPreview || localStorage.getItem('logo_timestamp')) && (
                <div style={{ 
                  width: '80px', 
                  height: '80px', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-sm)', 
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--bg-tertiary)'
                }}>
                  <img 
                    src={logoPreview || `/logo.png?t=${localStorage.getItem('logo_timestamp') || 'default'}`} 
                    alt="Logo Preview" 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              يفضل استخدام صورة ذات خلفية شفافة للحصول على أفضل مظهر.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button type="submit" className="btn btn-primary" disabled={settingsLoading}>
              {settingsLoading ? "جاري حفظ الإعدادات..." : "حفظ إعدادات الهوية والنظام"}
            </button>
          </div>
        </form>
      </div>

      {/* ADD / EDIT USER MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 800 }}>{modalType === 'add' ? 'إضافة مستخدم جديد' : 'تعديل بيانات مستخدم'}</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>اسم المستخدم أو الموظف:</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="مثال: خالد التميمي"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>كلمة المرور (باسورد الدخول):</label>
                  <div style={{ position: 'relative' }}>
                    <Key size={16} style={{ position: 'absolute', right: '12px', top: '13px', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="اكتب كلمة مرور قوية وفريدة..."
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      style={{ paddingRight: '36px' }}
                      required
                    />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    بما أن الدخول يعتمد على الباسورد فقط، يجب أن تكون كلمة المرور فريدة لكل حساب.
                  </span>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>صلاحية ودور الحساب:</label>
                  <select 
                    className="form-control"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                  >
                    <option value="viewer">متصفح (عرض وقراءة قاعدة البيانات العامة فقط - بدون حذف أو تعديل)</option>
                    <option value="admin">مدير النظام (له كافة الصلاحيات والإعدادات)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>إلغاء</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? "جاري الحفظ..." : "حفظ التغييرات"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
