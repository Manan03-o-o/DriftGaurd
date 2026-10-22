import React, { useState } from 'react';
import { Modal } from './Modal';
import { Cpu, RotateCcw } from 'lucide-react';

interface TrainModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: {
    name: string;
    version: string;
    algorithm: string;
    dataset_name: string;
    target_col: string;
    n_samples: number;
    random_seed: number;
  }) => Promise<void>;
  isLoading: boolean;
}

export const TrainModelModal: React.FC<TrainModelModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading
}) => {
  const [name, setName] = useState('CreditDefaultClassifier-V2');
  const [version, setVersion] = useState('1.1.0');
  const [algorithm, setAlgorithm] = useState('random_forest');
  const [datasetName, setDatasetName] = useState('credit_default');
  const [nSamples, setNSamples] = useState(3000);
  const [randomSeed, setRandomSeed] = useState(42);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      name,
      version,
      algorithm,
      dataset_name: datasetName,
      target_col: datasetName === 'breast_cancer' ? 'target' : 'default',
      n_samples: nSamples,
      random_seed: randomSeed
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Train & Register Baseline Model">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Model Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none"
              required
            />
          </div>
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Semantic Version</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Algorithm</label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-indigo-300 font-semibold outline-none"
            >
              <option value="random_forest">Random Forest Classifier</option>
              <option value="logistic_regression">Logistic Regression (L2 regularized)</option>
              <option value="hist_gradient_boosting">Hist Gradient Boosting</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Benchmark Dataset</label>
            <select
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none"
            >
              <option value="credit_default">Credit Risk / Loan Default (Tabular)</option>
              <option value="breast_cancer">Scikit-learn Breast Cancer (Numerical)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              Baseline Training Samples ({nSamples})
            </label>
            <input
              type="range"
              min="500"
              max="10000"
              step="500"
              value={nSamples}
              onChange={(e) => setNSamples(parseInt(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Deterministic Seed</label>
            <input
              type="number"
              value={randomSeed}
              onChange={(e) => setRandomSeed(parseInt(e.target.value) || 42)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono outline-none"
            />
          </div>
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
                <span>Training Pipeline...</span>
              </>
            ) : (
              <>
                <Cpu className="w-4 h-4" />
                <span>Train Baseline</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
