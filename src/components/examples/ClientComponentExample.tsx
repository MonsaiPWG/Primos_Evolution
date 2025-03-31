'use client'

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function ClientComponentExample() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();
  
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Ejemplo de uso: obtener datos del usuario actual
        const { data: { user } } = await supabase.auth.getUser();
        
        // Si hay un usuario, obtenemos sus datos
        if (user) {
          const { data, error: dbError } = await supabase
            .from('users')
            .select('*')
            .eq('wallet_address', user.id)
            .single();
            
          if (dbError) throw dbError;
          setUserData(data);
        }
        
        setError(null);
      } catch (err: any) {
        console.error('Error cargando datos:', err);
        setError(err.message || 'Error desconocido');
        setUserData(null);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
    
    // Suscripción a cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserData(session?.user || null);
    });
    
    // Limpieza al desmontar
    return () => subscription.unsubscribe();
  }, []);
  
  return (
    <div className="p-4 border rounded mt-4">
      <h2 className="text-xl font-bold mb-4">Ejemplo de Componente Cliente con Supabase</h2>
      <p className="mb-4">Este componente demuestra el uso de Supabase en un componente del cliente.</p>
      
      {loading ? (
        <p>Cargando datos...</p>
      ) : error ? (
        <div className="text-red-500">Error: {error}</div>
      ) : (
        <>
          <h3 className="text-lg font-semibold mb-2">Estado de autenticación:</h3>
          <p className="mb-4">{userData ? 'Usuario autenticado' : 'No autenticado'}</p>
          
          {userData && (
            <>
              <h3 className="text-lg font-semibold mb-2">Datos del usuario:</h3>
              <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-60">
                {JSON.stringify(userData, null, 2)}
              </pre>
            </>
          )}
        </>
      )}
    </div>
  );
}
