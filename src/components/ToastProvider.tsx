'use client';

import { ToastContainer } from 'react-toastify';

export function ToastProvider() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      newestOnTop
      theme="colored"
    />
  );
}
