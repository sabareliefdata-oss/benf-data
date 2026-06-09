import React, { useState, useEffect } from 'react';
import { Users, CreditCard, FolderGit2, CheckCircle2, AlertCircle, Upload, Play, RefreshCw } from 'lucide-react';

export default function Dashboard({ setActiveTab, triggerImport }) {
  const [stats, setStats] = useState({
    total: 0,
    linked: 0,
    pending: 0,
    missing: 0,
    projects: 0,
    linkPercentage: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/dashboard/stats`);
      const data = await res.json();

      const total = data.total || 0;
      const linked = data.linked || 0;
      const pending = data.pending || 0;
      const missing = data.missing || 0;
      const linkPercentage = total > 0 ? Math.round((linked / total) * 100) : 0;

      setStats({
        total,
        linked,
        pending,
        missing,
        projects: data.projects || 0,
        linkPercentage
      });
    } catch (error) {
      console.error("Failed to fetch dashboard stats", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>أهلاً بك في نظام إدارة المستفيدين</h3>
          <p style={{ color: 'var(--text-muted)' }}>إليك إحصائيات سريعة للعمل القائم اليوم</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchStats} style={{ minWidth: 'auto', padding: '10px' }}>
          <RefreshCw size={18} className={loading ? "spin" : ""} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Users size={28} />
          </div>
          <div className="stat-info">
            <h4>إجمالي المستفيدين</h4>
            <p>{stats.total}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
            <CheckCircle2 size={28} />
          </div>
          <div className="stat-info">
            <h4>البطائق المربوطة</h4>
            <p>{stats.linked}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}>
            <AlertCircle size={28} />
          </div>
          <div className="stat-info">
            <h4>بطائق معلقة</h4>
            <p>{stats.pending}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: 'rgb(139, 92, 246)' }}>
            <FolderGit2 size={28} />
          </div>
          <div className="stat-info">
            <h4>المشاريع النشطة</h4>
            <p>{stats.projects}</p>
          </div>
        </div>
      </div>

      {/* Progress Card */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '32px',
        marginBottom: '32px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>نسبة إنجاز ربط البطائق</h4>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>{stats.linkPercentage}%</span>
        </div>
        <div style={{ width: '100%', height: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{
            width: `${stats.linkPercentage}%`,
            height: '100%',
            backgroundColor: 'var(--success)',
            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
          }} />
        </div>
        <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          تم ربط {stats.linked} بطاقة تعريفية من أصل {stats.total} مستفيد مسجل في النظام.
        </p>
      </div>

      {/* Quick Actions & Tips */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>الوصول السريع</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {!(window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') && (
              <button className="btn btn-primary" onClick={triggerImport} style={{ justifyContent: 'flex-start' }}>
                <Upload size={18} />
                استيراد مستفيدين جدد (ملف Excel)
              </button>
            )}
            <button className="btn btn-success" onClick={() => setActiveTab('matching')} style={{ justifyContent: 'flex-start' }}>
              <Play size={18} />
              البدء بربط وقص البطائق (PDF)
            </button>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', color: 'var(--primary)' }}>نصيحة الاستخدام</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' }}>
            لتسريع عملية الربط الذكي، ضع ملفات الـ PDF التي تحتوي على البطائق في المجلد المخصص <strong>pdf_inputs</strong> داخل مجلد البرنامج الرئيسي. سيتعرف عليها النظام تلقائياً ويعرضها لك في تبويب "الربط الذكي" لقصها وربطها.
          </p>
        </div>
      </div>
    </div>
  );
}
