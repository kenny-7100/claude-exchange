use anchor_lang::prelude::*;

declare_id!("46DPoktitZL3c3kau4i4QCMFvtz23XpaytyGK2dH5MYD");

#[program]
pub mod gmsol_gt_incentive {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[cfg(not(feature = "no-entrypoint"))]
gmsol_utils::security_txt!("GMX-Solana GT Incentive Program");
