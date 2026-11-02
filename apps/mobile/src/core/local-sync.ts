import TcpSocket from 'react-native-tcp-socket';
import { localDbService } from './database';

const LOCAL_SYNC_PORT = 8080;
let activeServer: ReturnType<typeof TcpSocket.createServer> | null = null;
let activeServerSecret: string | null = null;

type LocalCommand = {
  id: string;
  token: string;
  action: 'ping' | 'snapshot' | 'verify_pin' | 'get_order' | 'place_order' | 'request_bill';
  payload?: Record<string, any>;
};


function sendJson(socket: any, value: unknown) {
  socket.write(`${JSON.stringify(value)}\n`);
  socket.end();
}

async function processCommand(command: LocalCommand, pairingSecret: string) {
  if (!command || command.token !== pairingSecret) {
    throw new Error('Este teléfono no está emparejado con la caja.');
  }

  const execute = () => switchCommand(command);
  if (command.action === 'place_order' || command.action === 'request_bill') {
    if (!command.id) throw new Error('Falta el identificador de la solicitud.');
    return localDbService.runIdempotentSyncCommand(command.id, execute);
  }
  return execute();
}

function switchCommand(command: LocalCommand) {
  switch (command.action) {
    case 'ping':
      return { paired: true };
    case 'snapshot':
      return localDbService.getSyncSnapshot();
    case 'verify_pin': {
      try {
        const user = localDbService.verifyStaffPin(String(command.payload?.pin ?? ''));
        if (!user || !String(user.role).startsWith('waiter')) {
          throw new Error('PIN de mesero incorrecto.');
        }
        return { full_name: user.full_name, role: user.role };
      } catch (error: any) {
        throw new Error(error?.message || 'No se pudo validar el PIN.');
      }
    }
    case 'get_order':
      if (!command.payload?.tableId) throw new Error('Mesa invalida.');
      return localDbService.getActiveOrder(command.payload.tableId);
    case 'place_order': {
      const { orderId, tableId, waiterName, items } = command.payload ?? {};
      if (!orderId || !tableId || !waiterName || !Array.isArray(items) || items.length === 0) {
        throw new Error('Comanda inválida.');
      }
      localDbService.saveOrderItems(orderId, tableId, waiterName, items);
      return { accepted: true };
    }
    case 'request_bill': {
      const tableId = command.payload?.tableId;
      if (!tableId) throw new Error('Mesa inválida.');
      localDbService.requestTableBill(tableId);
      return { accepted: true };
    }
    default:
      throw new Error('Operación local desconocida.');
  }
}

function handleConnection(socket: any, pairingSecret: string) {
  let buffered = '';
  socket.setTimeout(8000);
  socket.on('data', async (chunk: any) => {
    buffered += chunk.toString();
    if (buffered.length > 64_000) {
      sendJson(socket, { ok: false, error: 'Solicitud demasiado grande.' });
      return;
    }
    const newline = buffered.indexOf('\n');
    if (newline < 0) return;

    try {
      const command = JSON.parse(buffered.slice(0, newline)) as LocalCommand;
      const result = await processCommand(command, pairingSecret);
      sendJson(socket, { id: command.id, ok: true, result });
    } catch (error: any) {
      sendJson(socket, { ok: false, error: error?.message || 'Error de sincronización.' });
    }
  });
  socket.on('timeout', () => socket.destroy());
  socket.on('error', () => socket.destroy());
}

export function startLocalSyncServer(pairingSecret: string): Promise<void> {
  if (activeServer?.listening && activeServerSecret === pairingSecret) {
    return Promise.resolve();
  }
  if (activeServer?.listening) {
    const previousServer = activeServer;
    activeServer = null;
    activeServerSecret = null;
    return new Promise((resolve, reject) => {
      previousServer.close(() => {
        void startLocalSyncServer(pairingSecret).then(resolve, reject);
      });
    });
  }

  return new Promise((resolve, reject) => {
    const server = TcpSocket.createServer(socket => handleConnection(socket, pairingSecret));
    activeServer = server;
    server.once('error', error => {
      activeServer = null;
      activeServerSecret = null;
      reject(error);
    });
    server.once('listening', () => {
      activeServerSecret = pairingSecret;
      resolve();
    });
    server.listen({ port: LOCAL_SYNC_PORT, host: '0.0.0.0', reuseAddress: true });
  });
}

export function stopLocalSyncServer() {
  const server = activeServer;
  activeServer = null;
  activeServerSecret = null;
  server?.close();
}

export function sendLocalCommand<T>(
  serverAddress: string,
  pairingSecret: string,
  action: LocalCommand['action'],
  payload?: Record<string, any>,
  idempotencyKey?: string
): Promise<T> {
  const [host, rawPort] = serverAddress.split(':');
  const port = Number(rawPort || LOCAL_SYNC_PORT);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    return Promise.reject(new Error('La dirección de la caja no es válida.'));
  }

  const id = idempotencyKey ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    const socket = TcpSocket.createConnection({ host, port, connectTimeout: 5000 }, () => {
      socket.write(`${JSON.stringify({ id, token: pairingSecret, action, payload })}\n`);
    });
    let buffered = '';
    let settled = false;
    const finishError = (error: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(error);
    };
    socket.setTimeout(8000);
    socket.on('data', chunk => {
      buffered += chunk.toString();
      const newline = buffered.indexOf('\n');
      if (newline < 0) return;
      try {
        const response = JSON.parse(buffered.slice(0, newline));
        if (!response.ok) throw new Error(response.error || 'Falló la operación local.');
        settled = true;
        socket.destroy();
        resolve(response.result as T);
      } catch (error: any) {
        finishError(error instanceof Error ? error : new Error('Respuesta local inválida.'));
      }
    });
    socket.on('timeout', () => finishError(new Error('La caja no respondió a tiempo.')));
    socket.on('error', error => {
      finishError(new Error(error?.message || String(error) || 'No se pudo abrir el socket local.'));
    });
    socket.on('close', () => {
      if (!settled) finishError(new Error('La conexión con la caja se interrumpió.'));
    });
  });
}
