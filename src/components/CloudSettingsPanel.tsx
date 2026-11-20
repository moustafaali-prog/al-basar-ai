import React, { useState } from 'react';
import {
  CloudDownload,
  RefreshCw,
  Save,
  Server,
  WifiOff,
} from 'lucide-react';

import {
  SUPABASE_ANON_KEY_VALUE,
  SUPABASE_URL_VALUE,
  setSupabaseLocalOverrides,
} from '../utils/supabaseConfig';
import type { CloudAuthUser } from '../utils/supabaseAuth';

interface CloudSettingsPanelProps {
  isOnline: boolean;
  isSyncing: boolean;
  cloudUser: CloudAuthUser | null;
  onOpenLogin: () => void;
  onSync: () => void;
  onPullLatest: () => void;
}

/**
 * Supervisor-only technical surface. The examiner-facing modal stays free of
 * Supabase plumbing; every configuration detail lives here, behind the
 * PIN-protected admin drawer.
 */
export const CloudSettingsPanel: React.FC<CloudSettingsPanelProps> = ({
  isOnline,
  isSyncing,
  cloudUser,
  onOpenLogin,
  onSync,
  onPullLatest,
}) => {
  const [url, setUrl] = useState(SUPABASE_URL_VALUE);
  const [anonKey, setAnonKey] = useState(SUPABASE_ANON_KEY_VALUE);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const handleSave = () => {
    setSupabaseLocalOverrides(url, anonKey);
    setSavedHint('حُفظت الإعدادات محلياً. أعد تحميل الصفحة لتطبيقها.');
    setTestResult(null);
  };

  const handleTest = async () => {
    if (!isOnline) {
      setTestResult('لا يوجد اتصال بالإنترنت');
      return;
    }
    setTesting(true);
    setTestResult(null);
    setSavedHint(null);
    try {
      const { testSupabaseConnection } = await import('../utils/supabaseClient');
      const diag = await testSupabaseConnection(url, anonKey);
      setTestResult(
        diag.ok
          ? `✅ HTTP ${diag.status ?? ''} — ${diag.message}`
          : `❌ HTTP ${diag.status ?? ''}${diag.code ? ` (${diag.code})` : ''}: ${diag.message}`,
      );
    } catch (error) {
      setTestResult(`❌ خطأ: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="cloud-settings">
      <div className="cloud-settings__status">
        <Server size={16} aria-hidden="true" />
        <span>
          {cloudUser
            ? `متصل بـ Supabase — ${cloudUser.fullName || cloudUser.email || 'حساب فاحص'}`
            : 'غير مسجل الدخول — المزامنة تعمل بمفتاح anon العام.'}
        </span>
      </div>

      {!isOnline && (
        <div className="notice notice--warn" role="status">
          <WifiOff size={16} aria-hidden="true" />
          <span>وضع العمل بدون إنترنت — المزامنة عند عودة الشبكة.</span>
        </div>
      )}

      <div className="cloud-settings__actions">
        <button type="button" onClick={onOpenLogin} className="m3-btn m3-btn--primary">
          تسجيل الدخول
        </button>
        <button type="button" onClick={onSync} className="m3-btn" disabled={!isOnline || isSyncing}>
          {isSyncing ? 'جاري المزامنة…' : 'مزامنة الآن'}
        </button>
        <button type="button" onClick={onPullLatest} className="m3-btn" disabled={!isOnline || isSyncing}>
          <CloudDownload size={16} aria-hidden="true" />
          سحب أحدث السجلات من السحابة
        </button>
      </div>

      <details className="cloud-settings__details">
        <summary>إعدادات Supabase (للمشرف فقط)</summary>

        <label className="auth-field">
          <span>Supabase URL</span>
          <span className="auth-input">
            <input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-project.supabase.co" />
          </span>
        </label>

        <label className="auth-field">
          <span>Anon Key</span>
          <span className="auth-input">
            <input dir="ltr" value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="sb_publishable_..." />
          </span>
        </label>

        <div className="cloud-settings__actions">
          <button type="button" className="m3-btn" onClick={handleSave}>
            <Save size={16} aria-hidden="true" />
            حفظ الإعدادات
          </button>
          <button type="button" className="m3-btn" onClick={handleTest} disabled={testing || !isOnline}>
            <RefreshCw size={16} className={testing ? 'spin' : ''} aria-hidden="true" />
            {testing ? 'جاري الفحص…' : 'فحص الاتصال'}
          </button>
        </div>

        {savedHint && <p className="cloud-settings__hint">{savedHint}</p>}
        {testResult && <p className="cloud-settings__hint">{testResult}</p>}
      </details>
    </div>
  );
};
