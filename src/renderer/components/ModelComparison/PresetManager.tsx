/**
 * PresetManager - Modal for managing model comparison presets
 */

import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Preset, OpenRouterModel } from '../../../types/window';

interface PresetManagerProps {
  currentModels: (string | null)[];
  models: OpenRouterModel[];
  onLoadPreset: (modelIds: string[]) => void;
  onClose: () => void;
}

export function PresetManager({ currentModels, models, onLoadPreset, onClose }: PresetManagerProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    setLoading(true);
    const result = await window.api.presets.getAll();
    if (result.success && result.data) {
      setPresets(result.data);
    }
    setLoading(false);
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }

    const validModels = currentModels.filter(Boolean) as string[];
    if (validModels.length === 0) {
      toast.error('Please select at least one model first');
      return;
    }

    const id = crypto.randomUUID();
    const result = await window.api.presets.save(id, newPresetName.trim(), validModels);
    if (result.success) {
      toast.success('Preset saved');
      setNewPresetName('');
      loadPresets();
    } else {
      toast.error('Failed to save preset');
    }
  };

  const handleDeletePreset = async (id: string) => {
    const result = await window.api.presets.delete(id);
    if (result.success) {
      toast.success('Preset deleted');
      loadPresets();
    } else {
      toast.error('Failed to delete preset');
    }
  };

  const handleLoadPreset = (preset: Preset) => {
    try {
      const modelIds = JSON.parse(preset.models) as string[];
      onLoadPreset(modelIds);
      toast.success(`Loaded preset: ${preset.name}`);
    } catch {
      toast.error('Failed to load preset');
    }
  };

  const getModelName = (modelId: string): string => {
    const model = models.find((m) => m.id === modelId);
    return model?.name || modelId;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content preset-manager" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Model Presets</h2>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Save Current Selection */}
          <div className="save-preset-section">
            <h3>Save Current Selection</h3>
            <div className="current-models">
              {currentModels.filter(Boolean).length > 0 ? (
                currentModels
                  .filter(Boolean)
                  .map((modelId, i) => (
                    <span key={i} className="model-chip">
                      {getModelName(modelId as string)}
                    </span>
                  ))
              ) : (
                <span className="no-models-selected">No models selected</span>
              )}
            </div>
            <div className="save-preset-form">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Preset name..."
                onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
              />
              <button onClick={handleSavePreset} className="save-button">
                <Save size={16} />
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* Saved Presets */}
          <div className="saved-presets-section">
            <h3>Saved Presets</h3>
            {loading ? (
              <div className="loading-presets">Loading...</div>
            ) : presets.length === 0 ? (
              <div className="no-presets">No saved presets yet</div>
            ) : (
              <div className="presets-list">
                {presets.map((preset) => {
                  const modelIds = JSON.parse(preset.models) as string[];
                  return (
                    <div key={preset.id} className="preset-item">
                      <div className="preset-info">
                        <span className="preset-name">{preset.name}</span>
                        <div className="preset-models">
                          {modelIds.map((id, i) => (
                            <span key={i} className="model-chip small">
                              {getModelName(id)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="preset-actions">
                        <button
                          onClick={() => handleLoadPreset(preset)}
                          className="load-button"
                          title="Load this preset"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => handleDeletePreset(preset.id)}
                          className="delete-button"
                          title="Delete this preset"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
