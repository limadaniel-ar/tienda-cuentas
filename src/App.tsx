import { useState, useEffect } from 'react';
import { Plus, Bell, TrendingUp, Search, X, Edit2, Trash2, ArrowLeft, AlertCircle } from 'lucide-react';
import { supabase } from './supabaseClient';

// Tipos
interface Cliente {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  fecha_creacion: string;
}

interface Transaccion {
  id: string;
  cliente_id: string;
  fecha: string;
  tipo: 'compra' | 'pago';
  monto: number;
  observacion: string;
}

interface Notificacion {
  id: string;
  clienteId: string;
  clienteNombre: string;
  mensaje: string;
  saldoPendiente: number;
}

const App = () => {
  const [vista, setVista] = useState<'clientes' | 'detalle' | 'notificaciones'>('clientes');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [mostrarFormCliente, setMostrarFormCliente] = useState(false);
  const [mostrarFormTransaccion, setMostrarFormTransaccion] = useState(false);
  const [porcentajeAumento, setPorcentajeAumento] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [cargando, setCargando] = useState(true);

  // Formulario Cliente
  const [formCliente, setFormCliente] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    telefono: ''
  });

  // Formulario Transacción
  const [formTransaccion, setFormTransaccion] = useState({
    tipo: 'compra' as 'compra' | 'pago',
    monto: '',
    observacion: ''
  });

  // Cargar datos desde Supabase
const cargarClientes = async () => {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('fecha_creacion', { ascending: false });

  if (error) {
    console.error('Error cargando clientes:', error);
    return;
  }
  
  setClientes(data || []);
};


  const cargarTransacciones = async () => {
    const { data, error } = await supabase
      .from('transacciones')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) {
      console.error('Error cargando transacciones:', error);
    } else {
      setTransacciones(data || []);
    }
  };

  useEffect(() => {
    const cargarDatos = async () => {
      setCargando(true);
      await cargarClientes();
      await cargarTransacciones();
      setCargando(false);
    };
    cargarDatos();
  }, []);

  // Funciones de Cliente
  const agregarCliente = async () => {
    if (!formCliente.nombre || !formCliente.apellido || !formCliente.dni) {
      alert('Por favor complete los campos obligatorios');
      return;
    }

    const { data, error } = await supabase
      .from('clientes')
      .insert([formCliente])
      .select();

    if (error) {
      console.error('Error agregando cliente:', error);
      alert('Error al agregar cliente');
    } else {
      await cargarClientes();
      setFormCliente({ nombre: '', apellido: '', dni: '', telefono: '' });
      setMostrarFormCliente(false);
    }
  };

  const actualizarCliente = async () => {
    if (!editando) return;

    const { error } = await supabase
      .from('clientes')
      .update(formCliente)
      .eq('id', editando.id);

    if (error) {
      console.error('Error actualizando cliente:', error);
      alert('Error al actualizar cliente');
    } else {
      await cargarClientes();
      setEditando(null);
      setFormCliente({ nombre: '', apellido: '', dni: '', telefono: '' });
      setMostrarFormCliente(false);
    }
  };

  const eliminarCliente = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este cliente?')) return;

    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando cliente:', error);
      alert('Error al eliminar cliente');
    } else {
      await cargarClientes();
      await cargarTransacciones();
    }
  };

  const iniciarEdicion = (cliente: Cliente) => {
    setEditando(cliente);
    setFormCliente({
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      dni: cliente.dni,
      telefono: cliente.telefono || ''
    });
    setMostrarFormCliente(true);
  };

  // Funciones de Transacción
  const agregarTransaccion = async () => {
    if (!clienteSeleccionado || !formTransaccion.monto) {
      alert('Por favor complete todos los campos');
      return;
    }

    const { error } = await supabase
      .from('transacciones')
      .insert([{
        cliente_id: clienteSeleccionado.id,
        tipo: formTransaccion.tipo,
        monto: parseFloat(formTransaccion.monto),
        observacion: formTransaccion.observacion
      }]);

    if (error) {
      console.error('Error agregando transacción:', error);
      alert('Error al agregar transacción');
    } else {
      await cargarTransacciones();
      setFormTransaccion({ tipo: 'compra', monto: '', observacion: '' });
      setMostrarFormTransaccion(false);
    }
  };

  // Calcular saldo
  const calcularSaldo = (clienteId: string): number => {
    return transacciones
      .filter(t => t.cliente_id === clienteId)
      .reduce((saldo, t) => {
        return t.tipo === 'compra' ? saldo + t.monto : saldo - t.monto;
      }, 0);
  };

  // Aplicar porcentaje de aumento
  const aplicarAumento = async (clienteId: string) => {
    if (porcentajeAumento <= 0) return;

    const saldoActual = calcularSaldo(clienteId);
    const montoAumento = (saldoActual * porcentajeAumento) / 100;

    const { error } = await supabase
      .from('transacciones')
      .insert([{
        cliente_id: clienteId,
        tipo: 'compra',
        monto: montoAumento,
        observacion: `Aumento del ${porcentajeAumento}% aplicado`
      }]);

    if (error) {
      console.error('Error aplicando aumento:', error);
      alert('Error al aplicar aumento');
    } else {
      await cargarTransacciones();
      setPorcentajeAumento(0);
      alert(`Se aplicó un aumento del ${porcentajeAumento}% ($${montoAumento.toFixed(2)})`);
    }
  };

  // Obtener notificaciones
  const obtenerNotificaciones = (): Notificacion[] => {
    const haceUnMes = new Date();
    haceUnMes.setMonth(haceUnMes.getMonth() - 1);

    return clientes
      .map(cliente => {
        const saldo = calcularSaldo(cliente.id);
        const transaccionesCliente = transacciones.filter(t => t.cliente_id === cliente.id);
        const ultimoPago = transaccionesCliente
          .filter(t => t.tipo === 'pago')
          .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];

        const sinPagoReciente = !ultimoPago || new Date(ultimoPago.fecha) < haceUnMes;

        if (saldo > 0 && sinPagoReciente) {
          return {
            id: cliente.id,
            clienteId: cliente.id,
            clienteNombre: `${cliente.nombre} ${cliente.apellido}`,
            mensaje: 'Sin pagos en el último mes',
            saldoPendiente: saldo
          };
        }
        return null;
      })
      .filter(n => n !== null) as Notificacion[];
  };

  // Filtrar clientes
  const clientesFiltrados = clientes.filter(c =>
    `${c.nombre} ${c.apellido} ${c.dni}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 mb-2">Cargando...</div>
          <div className="text-gray-600">Espere un momento</div>
        </div>
      </div>
    );
  }

  // Renderizado
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            {vista !== 'clientes' && (
              <button
                onClick={() => {
                  setVista('clientes');
                  setClienteSeleccionado(null);
                }}
                className="p-2 hover:bg-blue-700 rounded"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h1 className="text-xl font-bold">Cuentas Corrientes</h1>
          </div>
          <button
            onClick={() => setVista('notificaciones')}
            className="relative p-2 hover:bg-blue-700 rounded"
          >
            <Bell size={24} />
            {obtenerNotificaciones().length > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {obtenerNotificaciones().length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-6xl mx-auto p-4">
        {/* Vista de Clientes */}
        {vista === 'clientes' && (
          <div>
            {/* Barra de búsqueda y botón agregar */}
            <div className="mb-4 flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>
              <button
                onClick={() => setMostrarFormCliente(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
              >
                <Plus size={20} />
                Nuevo Cliente
              </button>
            </div>

            {/* Lista de clientes */}
            <div className="grid gap-4">
              {clientesFiltrados.length === 0 ? (
                <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                  No hay clientes registrados
                </div>
              ) : (
                clientesFiltrados.map(cliente => {
                  const saldo = calcularSaldo(cliente.id);
                  return (
                    <div
                      key={cliente.id}
                      className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => {
                        setClienteSeleccionado(cliente);
                        setVista('detalle');
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg">
                            {cliente.nombre} {cliente.apellido}
                          </h3>
                          <p className="text-gray-600 text-sm">DNI: {cliente.dni}</p>
                          <p className="text-gray-600 text-sm">Tel: {cliente.telefono}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-bold ${saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ${saldo.toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {saldo > 0 ? 'Debe' : 'Al día'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            iniciarEdicion(cliente);
                          }}
                          className="text-blue-600 hover:text-blue-800 p-1"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            eliminarCliente(cliente.id);
                          }}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Vista de Detalle del Cliente */}
        {vista === 'detalle' && clienteSeleccionado && (
          <div>
            {/* Info del cliente */}
            <div className="bg-white p-6 rounded-lg shadow mb-4">
              <h2 className="text-2xl font-bold mb-2">
                {clienteSeleccionado.nombre} {clienteSeleccionado.apellido}
              </h2>
              <p className="text-gray-600">DNI: {clienteSeleccionado.dni}</p>
              <p className="text-gray-600">Teléfono: {clienteSeleccionado.telefono}</p>
              <div className="mt-4 pt-4 border-t">
                <p className="text-3xl font-bold text-red-600">
                  Saldo: ${calcularSaldo(clienteSeleccionado.id).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Acciones */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                onClick={() => setMostrarFormTransaccion(true)}
                className="bg-green-600 text-white p-4 rounded-lg flex items-center justify-center gap-2 hover:bg-green-700"
              >
                <Plus size={20} />
                Nueva Transacción
              </button>
              <div className="bg-white p-4 rounded-lg shadow">
                <label className="block text-sm font-medium mb-2">
                  Aplicar Aumento (%)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={porcentajeAumento}
                    onChange={(e) => setPorcentajeAumento(parseFloat(e.target.value) || 0)}
                    className="flex-1 border rounded px-2 py-1"
                    placeholder="0"
                  />
                  <button
                    onClick={() => aplicarAumento(clienteSeleccionado.id)}
                    className="bg-orange-600 text-white px-4 py-1 rounded hover:bg-orange-700"
                  >
                    <TrendingUp size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Historial de transacciones */}
            <div className="bg-white rounded-lg shadow">
              <h3 className="font-bold text-lg p-4 border-b">Historial de Transacciones</h3>
              <div className="divide-y">
                {transacciones
                  .filter(t => t.cliente_id === clienteSeleccionado.id)
                  .map(transaccion => (
                    <div key={transaccion.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">
                            {transaccion.tipo === 'compra' ? '🛍️ Compra' : '💰 Pago'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date(transaccion.fecha).toLocaleDateString('es-AR')}
                          </p>
                          {transaccion.observacion && (
                            <p className="text-sm text-gray-500 mt-1">
                              {transaccion.observacion}
                            </p>
                          )}
                        </div>
                        <p className={`text-lg font-bold ${
                          transaccion.tipo === 'compra' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {transaccion.tipo === 'compra' ? '+' : '-'}${transaccion.monto.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Vista de Notificaciones */}
        {vista === 'notificaciones' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Notificaciones</h2>
            {obtenerNotificaciones().length === 0 ? (
              <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                No hay notificaciones pendientes
              </div>
            ) : (
              <div className="grid gap-4">
                {obtenerNotificaciones().map(notif => (
                  <div
                    key={notif.id}
                    className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="text-orange-500 mt-1" size={24} />
                      <div className="flex-1">
                        <h3 className="font-bold">{notif.clienteNombre}</h3>
                        <p className="text-gray-600">{notif.mensaje}</p>
                        <p className="text-red-600 font-bold mt-2">
                          Saldo pendiente: ${notif.saldoPendiente.toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const cliente = clientes.find(c => c.id === notif.clienteId);
                          if (cliente) {
                            setClienteSeleccionado(cliente);
                            setVista('detalle');
                          }
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Ver detalles
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal Formulario Cliente */}
      {mostrarFormCliente && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {editando ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <button
                onClick={() => {
                  setMostrarFormCliente(false);
                  setEditando(null);
                  setFormCliente({ nombre: '', apellido: '', dni: '', telefono: '' });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formCliente.nombre}
                  onChange={(e) => setFormCliente({ ...formCliente, nombre: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Apellido *</label>
                <input
                  type="text"
                  value={formCliente.apellido}
                  onChange={(e) => setFormCliente({ ...formCliente, apellido: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">DNI *</label>
                <input
                  type="text"
                  value={formCliente.dni}
                  onChange={(e) => setFormCliente({ ...formCliente, dni: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teléfono</label>
                <input
                  type="text"
                  value={formCliente.telefono}
                  onChange={(e) => setFormCliente({ ...formCliente, telefono: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <button
                onClick={editando ? actualizarCliente : agregarCliente}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                {editando ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Formulario Transacción */}
      {mostrarFormTransaccion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Nueva Transacción</h3>
              <button
                onClick={() => {
                  setMostrarFormTransaccion(false);
                  setFormTransaccion({ tipo: 'compra', monto: '', observacion: '' });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select
                  value={formTransaccion.tipo}
                  onChange={(e) => setFormTransaccion({ ...formTransaccion, tipo: e.target.value as 'compra' | 'pago' })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="compra">Compra</option>
                  <option value="pago">Pago</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Monto *</label>
                <input
                  type="number"
                  value={formTransaccion.monto}
                  onChange={(e) => setFormTransaccion({ ...formTransaccion, monto: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Observación</label>
                <textarea
                  value={formTransaccion.observacion}
                  onChange={(e) => setFormTransaccion({ ...formTransaccion, observacion: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>
              <button
                onClick={agregarTransaccion}
                className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
              >
                Guardar Transacción
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

/*import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
*/