import type{ReactNode}from'react';
export function FeedbackBanner({tone='info',children,action}:{tone?:'info'|'success'|'warning'|'danger';children:ReactNode;action?:ReactNode}){return <div className={`advanced-feedback ${tone}`} role={tone==='danger'?'alert':'status'}><span>{children}</span>{action}</div>}
