import type{ErpApi}from'../services/api';import{AdvancedManagementPage}from'./advanced/AdvancedManagementPage';
export function DepthPage({api}:{api:ErpApi}){return <div data-testid="view-depth"><AdvancedManagementPage api={api}/></div>}
