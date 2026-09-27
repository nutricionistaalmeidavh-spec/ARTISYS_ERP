import type{ReactNode}from'react';
export function WorkspaceHeader({title,subtitle,actions}:{title:string;subtitle:string;actions?:ReactNode}){return <header className="advanced-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{actions&&<div className="advanced-header-actions">{actions}</div>}</header>}
