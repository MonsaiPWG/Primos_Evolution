import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ethers } from 'ethers';
import { calculateNFTPoints } from '@/services/nftService';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { wallet_address, transaction_hash } = await req.json();
    
    if (!wallet_address) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }
    
    // Verificar si el usuario existe
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', wallet_address.toLowerCase())
      .single();
    
    // Si no existe, crearlo
    if (!user) {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          wallet_address: wallet_address.toLowerCase(),
          current_streak: 1,
          max_streak: 1,
          total_check_ins: 1,
          last_check_in: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) throw createError;
      user = newUser;
    } else {
      // Actualizar streak y total_check_ins
      const lastCheckIn = new Date(user.last_check_in);
      const now = new Date();
      
      // Verificar si es un nuevo día (24 horas después del último check-in)
      const timeDiff = Math.abs(now.getTime() - lastCheckIn.getTime());
      const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
      
      if (daysDiff === 0) {
        return NextResponse.json({ 
          error: 'Already checked in today',
          user
        }, { status: 400 });
      }
      
      // Si es el día siguiente, incrementar streak
      const newStreak = daysDiff === 1 ? user.current_streak + 1 : 1;
      
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          current_streak: newStreak,
          max_streak: Math.max(newStreak, user.max_streak),
          total_check_ins: user.total_check_ins + 1,
          last_check_in: now.toISOString()
        })
        .eq('wallet_address', wallet_address.toLowerCase())
        .select()
        .single();
      
      if (updateError) throw updateError;
      user = updatedUser;
    }
    
    // Calcular multiplicador basado en el streak
    let multiplier = 1.0;
    if (user.current_streak >= 29) multiplier = 3.0;
    else if (user.current_streak >= 22) multiplier = 2.5;
    else if (user.current_streak >= 15) multiplier = 2.0;
    else if (user.current_streak >= 8) multiplier = 1.5;
    
    // Calcular puntos basados en NFTs
    const { totalPoints, eligibleNfts } = await calculateNFTPoints(wallet_address);
    
    // Aplicar multiplicador al total de puntos de NFTs
    // Si no tiene NFTs, no asignar puntos
    const basePoints = totalPoints > 0 ? totalPoints : 0;
    
    // Aplicar Math.round() solo cuando el multiplicador tiene decimales
    let pointsEarned;
    if (multiplier === 1.5 || multiplier === 2.5) {
      pointsEarned = Math.round(basePoints * multiplier);
    } else {
      pointsEarned = basePoints * multiplier;
    }
    
    // Registrar el check-in
    const { data: checkIn, error: checkInError } = await supabase
      .from('check_ins')
      .insert({
        user_id: user.id,
        wallet_address: wallet_address.toLowerCase(),
        streak_count: user.current_streak,
        points_earned: pointsEarned,
        multiplier: multiplier,
        transaction_hash: transaction_hash || null
      })
      .select()
      .single();
    
    if (checkInError) throw checkInError;
    
    // Registrar los NFTs usados en este check-in
    if (eligibleNfts && eligibleNfts.length > 0) {
      try {
        const nftUsageRecords = eligibleNfts.map(nft => ({
          token_id: nft.token_id,
          contract_address: nft.contract_address,
          wallet_address: wallet_address.toLowerCase(),
          check_in_id: checkIn.id,
          // usage_date se establece automáticamente como la fecha actual por el valor predeterminado
        }));

        const { error: usageError } = await supabase
          .from('nft_usage_tracking')
          .insert(nftUsageRecords);

        if (usageError) {
          // Si el error es por restricción única, significa que algún NFT ya fue usado hoy
          if (usageError.code === '23505') { // Código de error de PostgreSQL para violación de restricción única
            console.log('Algunos NFTs ya fueron usados hoy por otra wallet');
          } else {
            console.error('Error registering NFT usage:', usageError);
          }
        }
      } catch (error) {
        console.error('Error registering NFT usage:', error);
        // No fallamos el check-in si esto falla, solo registramos el error
      }
    }
    
    // Actualizar total_points
    const { error: pointsError } = await supabase
      .from('users')
      .update({
        total_points: user.total_points + pointsEarned
      })
      .eq('wallet_address', wallet_address.toLowerCase());
    
    if (pointsError) throw pointsError;
    
    return NextResponse.json({
      success: true,
      user: {
        ...user,
        total_points: user.total_points + pointsEarned
      },
      check_in: checkIn,
      points_earned: pointsEarned,
      multiplier
    });
    
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json({ error: 'Failed to process check-in' }, { status: 500 });
  }
}
