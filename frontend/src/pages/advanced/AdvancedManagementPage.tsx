import{useState}from'react';
import type{ErpApi}from'../../services/api';
import{WorkspaceNav,type AdvancedWorkspaceId}from'../../components/advanced/WorkspaceNav';
import{AccountingWorkspace}from'./AccountingWorkspace';
import{ProjectsWorkspace}from'./ProjectsWorkspace';
import{CrmWorkspace}from'./CrmWorkspace';
import{ShopFloorWorkspace}from'./ShopFloorWorkspace';
import{StockLogisticsWorkspace}from'./StockLogisticsWorkspace';
import{AssetAccountingWorkspace}from'./AssetAccountingWorkspace';
export function AdvancedManagementPage({api}:{api:ErpApi}){const[workspace,setWorkspace]=useState<AdvancedWorkspaceId>('accounting');let page;if(workspace==='accounting')page=<AccountingWorkspace api={api}/>;else if(workspace==='projects')page=<ProjectsWorkspace api={api}/>;else if(workspace==='crm')page=<CrmWorkspace api={api}/>;else if(workspace==='shop-floor')page=<ShopFloorWorkspace api={api}/>;else if(workspace==='stock-logistics')page=<StockLogisticsWorkspace api={api}/>;else page=<AssetAccountingWorkspace api={api}/>;return <div className="advanced-management"><WorkspaceNav value={workspace} onChange={setWorkspace}/><div className="advanced-workspace-stage">{page}</div></div>}
