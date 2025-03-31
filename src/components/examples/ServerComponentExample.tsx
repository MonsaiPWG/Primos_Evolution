import { createClient } from '@/utils/supabase/server';

export default async function ServerComponentExample() {
  const supabase = await createClient();
  
  // Ejemplo de uso: obtener datos protegidos
  const { data, error } = await supabase.from('users').select('*').limit(5);
  
  if (error) {
    return <div className="text-red-500">Error al cargar datos: {error.message}</div>;
  }
  
  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold mb-4">Ejemplo de Componente Servidor con Supabase</h2>
      <p className="mb-4">Este componente demuestra el uso de Supabase en un componente del servidor.</p>
      
      <h3 className="text-lg font-semibold mb-2">Datos cargados:</h3>
      <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-60">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
