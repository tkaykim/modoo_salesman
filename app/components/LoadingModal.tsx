'use client';

import React from 'react';

interface LoadingModalProps {
  isOpen: boolean;
  message?: string;
  submessage?: string;
}

const LoadingModal: React.FC<LoadingModalProps> = ({
  isOpen,
  message = '처리 중...',
  submessage
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {message}
            </h3>
            {submessage && (
              <p className="text-sm text-gray-600">
                {submessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingModal;
