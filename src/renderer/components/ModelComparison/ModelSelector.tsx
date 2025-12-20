/**
 * ModelSelector - Dropdown for selecting a model with search and filters
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { OpenRouterModel } from '../../../types/window';

interface ModelSelectorProps {
  models: OpenRouterModel[];
  selectedModelId: string | null;
  onSelectModel: (modelId: string | null) => void;
  loading?: boolean;
  disabled?: boolean;
}

const POPULAR_PROVIDERS = ['openai', 'anthropic', 'google', 'meta-llama', 'mistralai', 'deepseek'];

export function ModelSelector({ models, selectedModelId, onSelectModel, loading, disabled }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as HTMLElement)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get unique providers
  const providers = useMemo(() => {
    const providerSet = new Set(models.map((m) => m.id.split('/')[0]));
    return Array.from(providerSet).sort((a, b) => {
      const aPopular = POPULAR_PROVIDERS.indexOf(a);
      const bPopular = POPULAR_PROVIDERS.indexOf(b);
      if (aPopular !== -1 && bPopular !== -1) return aPopular - bPopular;
      if (aPopular !== -1) return -1;
      if (bPopular !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [models]);

  // Filter models
  const filteredModels = useMemo(() => {
    let filtered = models;

    if (providerFilter) {
      filtered = filtered.filter((m) => m.id.startsWith(providerFilter + '/'));
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (m) => m.id.toLowerCase().includes(searchLower) || m.name.toLowerCase().includes(searchLower)
      );
    }

    // Sort by popularity (based on provider order) then by name
    return filtered.sort((a, b) => {
      const aProvider = a.id.split('/')[0];
      const bProvider = b.id.split('/')[0];
      const aPopular = POPULAR_PROVIDERS.indexOf(aProvider);
      const bPopular = POPULAR_PROVIDERS.indexOf(bProvider);

      if (aPopular !== -1 && bPopular === -1) return -1;
      if (aPopular === -1 && bPopular !== -1) return 1;
      if (aPopular !== -1 && bPopular !== -1 && aPopular !== bPopular) return aPopular - bPopular;

      return a.name.localeCompare(b.name);
    });
  }, [models, search, providerFilter]);

  const selectedModel = models.find((m) => m.id === selectedModelId);

  const formatPrice = (price: string): string => {
    const num = parseFloat(price);
    if (num === 0) return 'Free';
    if (num < 0.001) return `$${num.toFixed(4)}/M`;
    return `$${num.toFixed(2)}/M`;
  };

  return (
    <div className="model-selector" ref={dropdownRef}>
      <button
        type="button"
        className="selector-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || loading}
      >
        {loading ? (
          <span className="selector-placeholder">Loading models...</span>
        ) : selectedModel ? (
          <div className="selector-selected">
            <span className="model-name">{selectedModel.name}</span>
            <span className="model-provider">{selectedModel.id.split('/')[0]}</span>
          </div>
        ) : (
          <span className="selector-placeholder">Select a model...</span>
        )}
        <ChevronDown size={16} className={`selector-arrow ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="selector-dropdown">
          {/* Search */}
          <div className="selector-search">
            <Search size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              autoFocus
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="clear-search">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Provider Filter */}
          <div className="provider-filter">
            <button
              type="button"
              className={`provider-chip ${!providerFilter ? 'active' : ''}`}
              onClick={() => setProviderFilter(null)}
            >
              All
            </button>
            {providers.slice(0, 6).map((provider) => (
              <button
                key={provider}
                type="button"
                className={`provider-chip ${providerFilter === provider ? 'active' : ''}`}
                onClick={() => setProviderFilter(providerFilter === provider ? null : provider)}
              >
                {provider}
              </button>
            ))}
          </div>

          {/* Model List */}
          <div className="model-list">
            {selectedModelId && (
              <button type="button" className="model-option clear-option" onClick={() => onSelectModel(null)}>
                <X size={14} />
                <span>Clear selection</span>
              </button>
            )}
            {filteredModels.length === 0 ? (
              <div className="no-models">No models found</div>
            ) : (
              filteredModels.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  className={`model-option ${model.id === selectedModelId ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectModel(model.id);
                    setIsOpen(false);
                  }}
                >
                  <div className="model-info">
                    <span className="model-name">{model.name}</span>
                    <span className="model-id">{model.id}</span>
                  </div>
                  <div className="model-meta">
                    <span className="model-context">{(model.context_length / 1000).toFixed(0)}k ctx</span>
                    <span className="model-price">{formatPrice(model.pricing.prompt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
