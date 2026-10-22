import React, { useState } from 'react';
import { Modal } from './Modal';
import { Play, RotateCcw } from 'lucide-react';

interface ReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: {
    scenario: string;
    batch_size: number;
    total_batches: number;
    random_seed: number;
  }) => Promise<void>;
  isLoading: boolean;
}

export const ReplayModal: React.FC<ReplayModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading
}) => {
  const [scenario, setScenario] = useState('mean_shift');
  const [batchSize, setBatchSize] = useState(150);
  const [totalBatches, setTotalBatches] = useState(3);
  const [randomSeed, setRandomSeed] = useState(42);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      scenario,
      batch_size: batchSize,
      total_batches: totalBatches,
      random_seed: randomSeed
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Replay Stream Batch & Simulate Drift">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="text-slate-300 font-semibold block mb-1">Drift Scenario</label>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-indigo-300 font-semibold outline-none"
          >
            <option value="no_shift">No Shift (Stationary Baseline)</option>
            <option value="mean_shift">Numerical Mean Shift (+DTI, -Credit Score)</option>
            <option value="variance_shift">Numerical Variance Expansion (2.2x Spread)</option>
            <option value="categorical_shift">Categorical Shift (80% Rent Spike)</option>
            <option value="class_imbalance_shift">Class Imbalance Shift (50%+ Default Rate)</option>
            <option value="concept_shift">Concept Shift P(Y|X) (Macroeconomic Shock)</option>
          </select>
          <p className="text-[11px] text-slate-400 mt-1">
            Simulates controlled distribution change over consecutive streaming batches.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              Batch Size ({batchSize})
            </label>
            <input
              type="range"
              min="50"
              max="500"
              step="25"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              Total Batches ({totalBatches})
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={totalBatches}
              onChange={(e) => setTotalBatches(parseInt(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>
        </div>

        <div>
          <label className="text-slate-300 font-semibold block mb-1">Deterministic Random Seed</label>
          <input
            type="number"
            value={randomSeed}
            onChange={(e) => setRandomSeed(parseInt(e.target.value) || 42)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono outline-none"
          />
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Replaying...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Replay Stream</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
