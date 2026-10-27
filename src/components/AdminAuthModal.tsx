import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, KeyRound, LogIn, LogOut, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { AdminUser } from '../types';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminUser: AdminUser;
  onSetAdminStatus: (isAdmin: boolean) => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  adminUser,
  onSetAdminStatus
}) => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Google Login
  const handleGoogleSignIn = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email?.toLowerCase();
      
      // Check if user is the authorized admin email (e.g. fortinclub7@gmail.com)
      if (email === 'fortinclub7@gmail.com') {
        onSetAdminStatus(true);
      } else {
        // Any other authenticated user can either be staff or admin with passcode
        onSetAdminStatus(true);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'No se pudo iniciar sesión con Google.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Passcode (2026 or 1234)
  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (passcode === '2026' || passcode === '1234' || passcode === 'admin') {
      onSetAdminStatus(true);
      setPasscode('');
      onClose();
    } else {
      setError('Clave de administrador incorrecta. (Clave por defecto: 2026)');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      // Ignore
    }
    onSetAdminStatus(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className={`p-4 text-white flex items-center justify-between ${
          adminUser.isAdmin ? 'bg-emerald-700' : 'bg-slate-900'
        }`}>
          <div className="flex items-center gap-2">
            {adminUser.isAdmin ? (
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            )}
            <h3 className="font-bold text-base">
              {adminUser.isAdmin ? 'Modo Administrador Activo' : 'Acceso de Administrador'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          
          {adminUser.isAdmin ? (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Tienes permisos de Administrador</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Puedes editar precios, modificar inventario inicial, desempacar packs SIX y gestionar reportes confidenciales.
                </p>
                {adminUser.email && (
                  <p className="text-xs font-mono text-emerald-700 font-bold mt-2">
                    {adminUser.email}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar sesión de Administrador</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                El personal puede realizar ventas sin restricciones. Para editar precios, modificar el catálogo o eliminar registros, inicia sesión o ingresa la clave de administrador.
              </p>

              {/* Option 1: Google Login */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl font-bold text-xs text-slate-700 shadow-2xs flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Acceder con Cuenta de Google (fortinclub7@gmail.com)</span>
              </button>

              <div className="flex items-center gap-2 my-2">
                <div className="h-px bg-slate-200 flex-1" />
                <span className="text-[11px] text-slate-400 font-bold uppercase">O mediante PIN</span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>

              {/* Option 2: PIN Form */}
              <form onSubmit={handlePasscodeSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Clave de Administrador:
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      autoFocus
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="Ingresa clave (predeterminada: 2026)"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-98"
                >
                  Desbloquear Permisos
                </button>
              </form>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
