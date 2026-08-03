/// <reference types="vite/client" />

import 'react';

declare module 'react' {
  interface VideoHTMLAttributes<T> extends HTMLAttributes<T> {
    referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  }
}
