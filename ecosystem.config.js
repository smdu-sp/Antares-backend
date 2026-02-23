module.exports = {
  apps: [
    {
      name: 'antares-backend',
      script: 'dist/main.js',
      instances: 'max', // Usar todos os CPUs disponíveis
      exec_mode: 'cluster', // Modo cluster para balanceamento de carga
      
      // Variáveis de ambiente
      env: {
        NODE_ENV: 'production',
      },
      
      // Logs
      error_file: 'logs/error.log',
      out_file: 'logs/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Reiniciar se usar muita memória
      max_memory_restart: '1G',
      
      // Reiniciar em caso de erro
      autorestart: true,
      
      // Esperar aplicação estar pronta antes de considerar iniciada
      wait_ready: true,
      listen_timeout: 10000,
      
      // Não matar processos abruptamente
      kill_timeout: 5000,
      
      // Variáveis de ambiente adicionais
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
