import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

/** Serif page title with an optional muted subtitle and a right-hand slot. */
export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        <h1 className="page-header__title">{title}</h1>
        {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
      </div>
      {right ? <div className="page-header__right">{right}</div> : null}
    </header>
  );
}
