'use client';

import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X } from 'lucide-react';
import Image from 'next/image';
import { RequestDetails } from './RequestDetails';
import { RequestStatusBadge } from './RequestStatusBadge';
import { MediaRequest } from '@/types/requests';

interface RequestDetailModalProps {
  request: MediaRequest;
  isOpen: boolean;
  onClose: () => void;
}

export function RequestDetailModal({ request, isOpen, onClose }: RequestDetailModalProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-70" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-gray-900 text-left align-middle shadow-xl transition-all">
                <div className="relative">
                  <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 bg-gray-800/80 rounded-full hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                  
                  <div className="p-6">
                    <div className="flex items-start gap-4 mb-6">
                      {request.posterPath && (
                        <Image
                          src={`https://image.tmdb.org/t/p/w185${request.posterPath}`}
                          alt={request.title}
                          width={92}
                          height={138}
                          className="rounded-lg flex-shrink-0"
                        />
                      )}
                      
                      <div>
                        <Dialog.Title as="h3" className="text-2xl font-bold text-white mb-2">
                          {request.title}
                        </Dialog.Title>
                        <div className="flex items-center gap-3">
                          <RequestStatusBadge status={request.status} />
                          <span className="text-sm text-gray-400 capitalize">{request.mediaType}</span>
                        </div>
                      </div>
                    </div>
                    
                    <RequestDetails request={request} />
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}