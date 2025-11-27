import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  DiagramOptions,
  DiagramTemplate,
  ScanData,
  generateDiagramPreview,
  downloadDiagram,
  fetchDiagramTemplates,
  saveDiagramTemplate,
  deleteDiagramTemplate,
} from '../api';

interface DiagramBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  scanData: ScanData | null;
}

const DEFAULT_OPTIONS: DiagramOptions = {
  include_containers: true,
  include_vms: true,
  include_iot_devices: true,
  include_vlans: true,
  include_aps: true,
  theme: 'light',
};

const DiagramBuilder: React.FC<DiagramBuilderProps> = ({ isOpen, onClose, scanData }) => {
  const [options, setOptions] = useState<DiagramOptions>(DEFAULT_OPTIONS);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [templates, setTemplates] = useState<DiagramTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // Load templates on mount
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  // Update theme based on document theme
  useEffect(() => {
    const theme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark';
    setOptions(prev => ({ ...prev, theme: theme || 'light' }));
  }, []);

  const loadTemplates = async () => {
    try {
      const loadedTemplates = await fetchDiagramTemplates();
      setTemplates(loadedTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast.error('Failed to load diagram templates');
    }
  };

  const handleRefreshPreview = async () => {
    if (!scanData) {
      toast.error('No scan data available. Please run a scan first.');
      return;
    }

    setIsGenerating(true);
    try {
      const svg = await generateDiagramPreview(options);
      setPreviewSvg(svg);
      toast.success('Preview generated!');
    } catch (error: any) {
      console.error('Preview generation failed:', error);
      toast.error(error.message || 'Failed to generate preview');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (format: 'png' | 'svg') => {
    if (!scanData) {
      toast.error('No scan data available. Please run a scan first.');
      return;
    }

    setIsGenerating(true);
    try {
      await downloadDiagram(format, options);
      toast.success(`Diagram downloaded as ${format.toUpperCase()}!`);
    } catch (error: any) {
      console.error('Download failed:', error);
      toast.error(error.message || 'Failed to download diagram');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTemplateChange = (templateName: string) => {
    setSelectedTemplate(templateName);
    if (templateName === 'custom') {
      setOptions(DEFAULT_OPTIONS);
    } else {
      const template = templates.find(t => t.name === templateName);
      if (template) {
        setOptions(template.options);
      }
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    try {
      await saveDiagramTemplate(newTemplateName, options);
      toast.success(`Template "${newTemplateName}" saved!`);
      setShowSaveDialog(false);
      setNewTemplateName('');
      await loadTemplates();
      setSelectedTemplate(newTemplateName);
    } catch (error: any) {
      console.error('Failed to save template:', error);
      toast.error(error.message || 'Failed to save template');
    }
  };

  const handleDeleteTemplate = async () => {
    if (selectedTemplate === 'custom') {
      return;
    }

    if (!confirm(`Delete template "${selectedTemplate}"?`)) {
      return;
    }

    try {
      await deleteDiagramTemplate(selectedTemplate);
      toast.success(`Template "${selectedTemplate}" deleted`);
      await loadTemplates();
      setSelectedTemplate('custom');
      setOptions(DEFAULT_OPTIONS);
    } catch (error: any) {
      console.error('Failed to delete template:', error);
      toast.error(error.message || 'Failed to delete template');
    }
  };

  // Calculate counts for display
  const getCounts = () => {
    if (!scanData) return { containers: 0, vms: 0, iot: 0, vlans: 0, aps: 0 };
    return {
      containers: scanData.containers?.length || 0,
      vms: scanData.vms?.length || 0,
      iot: scanData.network?.clients?.length || 0,
      vlans: scanData.network?.networks?.length || 0,
      aps: scanData.network?.access_points?.length || 0,
    };
  };

  const counts = getCounts();

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onClose}
      >
        {/* Modal Content */}
        <div
          style={{
            background: document.documentElement.getAttribute('data-theme') === 'dark'
              ? '#1a1a1a'
              : '#ffffff',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '1200px',
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
            border: document.documentElement.getAttribute('data-theme') === 'dark'
              ? '1px solid #333'
              : '1px solid #ddd',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ marginTop: 0, marginBottom: '24px', color: 'var(--text-primary)' }}>
            📊 Network Diagram Builder
          </h2>

          {/* Template Management Bar */}
          <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>Template:</label>
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  flex: 1,
                  minWidth: '200px',
                }}
              >
                <option value="custom">Custom</option>
                {templates.map(template => (
                  <option key={template.id} value={template.name}>{template.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowSaveDialog(true)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px' }}
              >
                💾 Save Template
              </button>
              {selectedTemplate !== 'custom' && (
                <button
                  onClick={handleDeleteTemplate}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          </div>

          {/* Save Template Dialog */}
          {showSaveDialog && (
            <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '2px solid var(--accent-color)' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Save Template</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Template name (e.g., Work Demo)"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && handleSaveTemplate()}
                />
                <button onClick={handleSaveTemplate} className="btn btn-primary">Save</button>
                <button onClick={() => {
setShowSaveDialog(false);
                  setNewTemplateName('');
                }} className="btn btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {/* Main Content: Two columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* Left Panel: Options */}
            <div>
              <h3 style={{ color: 'var(--text-primary)', marginTop: 0 }}>Components to Include</h3>

              {/* Checkboxes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={options.include_containers}
                    onChange={(e) => setOptions({ ...options, include_containers: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>🐳 Docker Containers ({counts.containers})</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={options.include_vms}
                    onChange={(e) => setOptions({ ...options, include_vms: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>🖥️ Proxmox VMs ({counts.vms})</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={options.include_iot_devices}
                    onChange={(e) => setOptions({ ...options, include_iot_devices: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>📱 Network Devices ({counts.iot})</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={options.include_vlans}
                    onChange={(e) => setOptions({ ...options, include_vlans: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>📁 Networks/VLANs ({counts.vlans})</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={options.include_aps}
                    onChange={(e) => setOptions({ ...options, include_aps: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>📡 Access Points ({counts.aps})</span>
                </label>
              </div>

              {/* Theme Selector */}
              <div style={{ marginTop: '24px' }}>
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '12px' }}>Theme</h4>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ flex: 1, cursor: 'pointer' }}>
                    <div
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: options.theme === 'light' ? '2px solid #3b82f6' : '1px solid #444',
                        backgroundColor: options.theme === 'light' ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-secondary)',
                        textAlign: 'center',
                      }}
                    >
                      <input
                        type="radio"
                        name="diagram-theme"
                        value="light"
                        checked={options.theme === 'light'}
                        onChange={() => setOptions({ ...options, theme: 'light' })}
                        style={{ display: 'none' }}
                      />
                      <div style={{ fontSize: '1.5em' }}>☀️</div>
                      <div style={{ color: 'var(--text-primary)', fontWeight: options.theme === 'light' ? 'bold' : 'normal', marginTop: '4px' }}>
                        Light
                      </div>
                    </div>
                  </label>
                  <label style={{ flex: 1, cursor: 'pointer' }}>
                    <div
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: options.theme === 'dark' ? '2px solid #3b82f6' : '1px solid #444',
                        backgroundColor: options.theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-secondary)',
                        textAlign: 'center',
                      }}
                    >
                      <input
                        type="radio"
                        name="diagram-theme"
                        value="dark"
                        checked={options.theme === 'dark'}
                        onChange={() => setOptions({ ...options, theme: 'dark' })}
                        style={{ display: 'none' }}
                      />
                      <div style={{ fontSize: '1.5em' }}>🌙</div>
                      <div style={{ color: 'var(--text-primary)', fontWeight: options.theme === 'dark' ? 'bold' : 'normal', marginTop: '4px' }}>
                        Dark
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Refresh Preview Button */}
              <button
                onClick={handleRefreshPreview}
                disabled={isGenerating}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '24px', padding: '12px' }}
              >
                {isGenerating ? '⏳ Generating...' : '🔄 Refresh Preview'}
              </button>
            </div>

            {/* Right Panel: Preview */}
            <div>
              <h3 style={{ color: 'var(--text-primary)', marginTop: 0 }}>Preview</h3>
              <div
                style={{
                  minHeight: '400px',
                  border: '2px dashed var(--border-color)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '16px',
                  overflow: 'auto',
                }}
              >
                {isGenerating ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '3em', marginBottom: '16px' }}>⏳</div>
                    <div>Generating diagram...</div>
                  </div>
                ) : previewSvg ? (
                  <div dangerouslySetInnerHTML={{ __html: previewSvg }} />
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '3em', marginBottom: '16px' }}>📊</div>
                    <div>Click "Refresh Preview" to generate diagram</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer: Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button
              onClick={() => handleDownload('svg')}
              disabled={isGenerating}
              className="btn btn-secondary"
              style={{ padding: '10px 20px' }}
            >
              📥 Download SVG
            </button>
            <button
              onClick={() => handleDownload('png')}
              disabled={isGenerating}
              className="btn btn-primary"
              style={{ padding: '10px 20px' }}
            >
              📥 Download PNG
            </button>
            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '10px 20px' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DiagramBuilder;
