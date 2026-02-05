import { useState } from 'react';
import { addFirewall } from '../../services/inventoryService';
import { X, Plus, HelpCircle, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const TOKEN_GUIDE_STEPS = [
  "Accedi all'interfaccia web del FortiGate (https://IP_FIREWALL:PORTA)",
  "Vai su System > Administrators",
  "Clicca su 'Create New' > 'REST API Admin'",
  "Inserisci un nome utente (es. 'sauron-api')",
  "Seleziona un profilo admin (es. 'super_admin' o profilo read-only)",
  "In 'Trusted Hosts' inserisci l'IP del server Sauron (es. 10.0.0.5/32)",
  "Clicca 'OK' - il sistema mostrerà il token API generato",
  "Copia il token e salvalo. NON sarà più visibile dopo la chiusura della finestra.",
];

export const AddFirewallForm = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ id: '', host: '', token: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const validateField = (name, value) => {
    if (!value.trim()) return 'Campo obbligatorio';
    if (name === 'host') {
      if (!value.includes(':')) return "Formato: IP:PORTA (es. 10.0.0.1:10443)";
      const lastColon = value.lastIndexOf(':');
      const ip = value.substring(0, lastColon);
      const port = value.substring(lastColon + 1);
      if (!/^\d+$/.test(port)) return "La porta deve essere un numero";
      if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return "Formato IP non valido";
    }
    return null;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      const err = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: err }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validazione
    const newErrors = {};
    Object.entries(formData).forEach(([key, val]) => {
      const err = validateField(key, val);
      if (err) newErrors[key] = err;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      const result = await addFirewall({
        id: formData.id.trim(),
        host: formData.host.trim(),
        token: formData.token.trim(),
      });
      toast.success(result.message || 'Firewall aggiunto con successo!');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Aggiungi Firewall</h2>
            <p className="text-sm text-slate-400 mt-0.5">Inserisci i dati del nuovo dispositivo</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
          {/* Nome Firewall */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
              Nome Firewall
            </label>
            <input
              type="text"
              name="id"
              value={formData.id}
              onChange={handleChange}
              placeholder="es. Firewall Milano Sede"
              className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all ${errors.id ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}
            />
            {errors.id && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.id}
              </p>
            )}
          </div>

          {/* Host IP:Porta */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
              Indirizzo Host (IP:Porta)
            </label>
            <input
              type="text"
              name="host"
              value={formData.host}
              onChange={handleChange}
              placeholder="es. 10.101.201.1:10443"
              className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm font-mono font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all ${errors.host ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}
            />
            {errors.host && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.host}
              </p>
            )}
          </div>

          {/* Token */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                API Token
              </label>
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="flex items-center gap-1 text-xs font-bold text-blue-500 hover:text-blue-700 transition-colors"
              >
                <HelpCircle size={14} />
                Come creare il token?
              </button>
            </div>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                name="token"
                value={formData.token}
                onChange={handleChange}
                placeholder="es. tjz3p0qm7zg7kjQ76mQHf1pzc00pxf"
                className={`w-full px-4 py-3 pr-12 bg-slate-50 border rounded-xl text-sm font-mono font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all ${errors.token ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.token && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.token}
              </p>
            )}
          </div>

          {/* Token Guide */}
          {showGuide && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
              <h4 className="text-sm font-bold text-blue-800 mb-3">
                Guida: Creare un API Token su FortiGate
              </h4>
              <ol className="space-y-2">
                {TOKEN_GUIDE_STEPS.map((step, idx) => (
                  <li key={idx} className="flex gap-3 text-xs text-blue-700">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-200 text-blue-800 rounded-full flex items-center justify-center font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:bg-slate-300 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Aggiungi Firewall
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
