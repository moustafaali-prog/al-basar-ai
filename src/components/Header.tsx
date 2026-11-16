import React from 'react';
import {
  Activity,
  BarChart3,
  ChevronRight,
  CircleHelp,
  Eye,
  Ruler,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { CalibrationData } from '../types';

type AdminView = 'calib' | 'database' | 'sus';

interface HeaderProps {
  calibration: CalibrationData;
  isCalibrationVerified: boolean;
  activeAdminView: AdminView | null;
  recordsCount?: number;
  onOpenCalibration: () => void;
  onOpenDatabase: () => void;
  onOpenSUS: () => void;
  onOpenMethodology: () => void;
  onExitAdmin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  calibration,
  isCalibrationVerified,
  activeAdminView,
  recordsCount,
  onOpenCalibration,
  onOpenDatabase,
  onOpenSUS,
  onOpenMethodology,
  onExitAdmin,
}) => (
  <header className="topbar">
    <div className="topbar__inner" dir="rtl">
      <div className="brand">
        <div className="brand__mark"><Eye size={23} aria-hidden="true" /></div>
        <div className="brand__copy">
          <h1 className="brand__title">البصر <span>Al-Basar</span></h1>
          <p className="brand__sub">فحص البصر المدرسي · الصحة المدرسية</p>
        </div>
      </div>

      <div className="topbar__tools">
        <span
          className={`status-chip ${isCalibrationVerified ? 'is-ok' : 'is-warn'}`}
          role="status"
          title={`${calibration.pxPerMM} px/mm · ${calibration.estimatedDPI} DPI`}
        >
          {isCalibrationVerified ? <ShieldCheck size={14} aria-hidden="true" /> : <Activity size={14} aria-hidden="true" />}
          {isCalibrationVerified ? 'الشاشة معايرة' : 'تحقق من المعايرة'}
        </span>

        <div className="topbar__divider" aria-hidden="true" />

        <button
          type="button"
          onClick={onOpenCalibration}
          className={`icon-action${activeAdminView === 'calib' ? ' is-active' : ''}`}
          title="المعايرة"
          aria-label="المعايرة"
        >
          <span aria-hidden="true">📏</span>
          <span className="icon-action__label">المعايرة</span>
        </button>

        <button
          type="button"
          onClick={onOpenDatabase}
          className={`icon-action${activeAdminView === 'database' ? ' is-active' : ''}`}
          title="السجلات والإحصاء"
          aria-label="السجلات والإحصاء"
          style={{ position: 'relative' }}
        >
          <span aria-hidden="true">📊</span>
          <span className="icon-action__label">السجلات والإحصاء</span>
          {typeof recordsCount === 'number' && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '-4px',
                insetInlineEnd: '-4px',
                minWidth: '18px',
                height: '18px',
                padding: '0 5px',
                borderRadius: '999px',
                background: 'var(--m3-primary)',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            >
              {recordsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenSUS}
          className={`icon-action${activeAdminView === 'sus' ? ' is-active' : ''}`}
          title="تقييم التطبيق"
          aria-label="تقييم التطبيق"
        >
          <span aria-hidden="true">⭐</span>
          <span className="icon-action__label">تقييم التطبيق</span>
        </button>

        <button
          type="button"
          onClick={onOpenMethodology}
          className="icon-action"
          title="الدليل والمنهجية"
          aria-label="الدليل والمنهجية"
        >
          <span aria-hidden="true">❓</span>
          <span className="icon-action__label">الدليل</span>
        </button>

        {activeAdminView && (
          <>
            <div className="topbar__divider" aria-hidden="true" />
            <button type="button" onClick={onExitAdmin} className="icon-action icon-action--back" title="العودة إلى الفحص">
              <ChevronRight size={18} aria-hidden="true" />
              <span className="icon-action__label">العودة للفحص</span>
            </button>
          </>
        )}
      </div>
    </div>
  </header>
);
