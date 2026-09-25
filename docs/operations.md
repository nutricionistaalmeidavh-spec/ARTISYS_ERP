# Operação do ArtiSys ERP

O ERP opera localmente. O desktop inicia um servidor HTTP apenas em `127.0.0.1` e usa o banco SQLite `artisys-erp.sqlite` no diretório de dados da aplicação.

## Backup e restauração

O runtime persistente expõe o serviço `backup`. `createBackup()` gera um snapshot SQLite consistente em `backups/`. A restauração copia um snapshot validado para um novo arquivo de banco; para substituir o banco ativo, feche a aplicação antes da troca do arquivo.

## Diagnóstico

`health` executa `PRAGMA quick_check`, registra versão do runtime e tamanho do banco. Logs e pacotes de diagnóstico sanitizam senhas, hashes, tokens e conteúdo bruto de arquivos bancários.

## Operação offline

Login, cadastros, estoque, compras, vendas administrativas, financeiro, relatórios e backup não exigem internet ou credenciais externas. Integrações futuras deverão ser opcionais e desligadas por padrão.
