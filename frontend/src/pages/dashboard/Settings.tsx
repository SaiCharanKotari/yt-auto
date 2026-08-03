import { Save, Loader2, Shield, Brain, TestTube, Eye, EyeOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface SettingsState {
  openrouter_api_key: string;
  openrouter_model: string;
  google_client_id: string;
  google_client_secret: string;
  google_redirect_uri: string;
  mongodb_uri: string;
  port: string;
  [key: string]: string;
}

const DEFAULT_SETTINGS: SettingsState = {
  openrouter_api_key: '',
  openrouter_model: 'tencent/hy3:free',
  google_client_id: '93723823038-8pm2ho2qg73q5ig8qqrqhglpqri6231j.apps.googleusercontent.com',
  google_client_secret: '',
  google_redirect_uri: 'http://localhost:3001/api/auth/google/callback',
  mongodb_uri: '',
  port: '3001',
};

const SETTING_GROUPS = [
  {
    id: 'ai',
    label: 'AI Configuration',
    icon: Brain,
    description: 'Configure AI model and API keys for ClipFlow analysis',
    fields: [
      { key: 'openrouter_api_key', label: 'OpenRouter API Key', type: 'password', placeholder: 'sk-or-v1-...', description: 'Get your key from openrouter.ai' },
      { key: 'openrouter_model', label: 'AI Model', type: 'select', options: [
        { value: 'tencent/hy3:free', label: 'Tencent Hunyuan 3 (Free)' },
        { value: 'google/gemini-flash-1.5:free', label: 'Google Gemini Flash 1.5 (Free)' },
        { value: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B Instruct (Free)' },
        { value: 'microsoft/phi-3-medium-128k-instruct:free', label: 'Phi-3 Medium 128K (Free)' },
        { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (Paid)' },
        { value: 'openai/gpt-4o', label: 'GPT-4o (Paid)' },
      ], description: 'Select the AI model for video analysis' },
    ],
  },
  {
    id: 'auth',
    label: 'Google OAuth',
    icon: Shield,
    description: 'YouTube API authentication credentials',
    fields: [
      { key: 'google_client_id', label: 'Client ID', type: 'text', placeholder: 'xxx.apps.googleusercontent.com', description: 'From Google Cloud Console' },
      { key: 'google_client_secret', label: 'Client Secret', type: 'password', placeholder: 'GOCSPX-...', description: 'From Google Cloud Console' },
      { key: 'google_redirect_uri', label: 'Redirect URI', type: 'text', placeholder: 'http://localhost:3001/api/auth/google/callback', description: 'Must match Google Cloud Console' },
    ],
  },
  {
    id: 'database',
    label: 'Database',
    icon: TestTube,
    description: 'MongoDB connection settings',
    fields: [
      { key: 'mongodb_uri', label: 'MongoDB URI', type: 'password', placeholder: 'mongodb+srv://user:pass@cluster.mongodb.net/db', description: 'Full connection string from MongoDB Atlas' },
    ],
  },
  {
    id: 'server',
    label: 'Server',
    icon: Eye,
    description: 'Backend server configuration',
    fields: [
      { key: 'port', label: 'Port', type: 'number', placeholder: '3001', description: 'Backend server port' },
    ],
  },
];

export default function Settings() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Load settings from backend
  useEffect(() => {
    fetch('http://localhost:3001/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setSettings(prev => ({ ...prev, ...data }));
        }
      })
      .catch(err => console.error('Failed to load settings:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    
    try {
      // Save each setting individually
      const promises = Object.entries(settings).map(([key, value]) => 
        fetch('http://localhost:3001/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value }),
        })
      );
      
      await Promise.all(promises);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Settings</h1>
        <p className="text-gray-400">Configure API keys, authentication, and server settings</p>
      </div>

      {saveStatus === 'success' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-green-500/10 border border-green-500/30 text-green-400 p-4 rounded-xl flex items-center justify-between"
        >
          <p>Settings saved successfully!</p>
        </motion.div>
      )}

      {saveStatus === 'error' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center justify-between"
        >
          <p>Failed to save settings. Please try again.</p>
        </motion.div>
      )}

      <div className="space-y-6">
        {SETTING_GROUPS.map(group => {
          const Icon = group.icon;
          return (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3 mb-6">
                <Icon className="w-6 h-6 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold text-white">{group.label}</h2>
                  <p className="text-sm text-gray-400">{group.description}</p>
                </div>
              </div>

              <div className="space-y-5">
                {group.fields.map(field => (
                  <div key={field.key} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">{field.label}</label>
                    <div className="relative">
                      {field.type === 'select' ? (
                        <select
                          value={settings[field.key]}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none"
                        >
                          {field.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : field.type === 'number' ? (
                        <input
                          type="number"
                          value={settings[field.key]}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />
                      ) : (
                        <>
                          <input
                            type={showSecrets[field.key] ? 'text' : (field.type === 'password' ? 'password' : 'text')}
                            value={settings[field.key]}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${field.type === 'password' ? 'pr-12' : ''}`}
                          />
                          {field.type === 'password' && (
                            <button
                              type="button"
                              onClick={() => toggleSecret(field.key)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                            >
                              {showSecrets[field.key] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {field.description && (
                      <p className="text-xs text-gray-500">{field.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Save Button - Fixed at bottom */}
      <div className="sticky bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pt-6 pb-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save All Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}