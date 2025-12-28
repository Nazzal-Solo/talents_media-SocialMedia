import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Navbar } from '@/components/navbar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast-context';
import { Check, Zap } from 'lucide-react';

export default function ApplyBillingPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [selectingPlanId, setSelectingPlanId] = useState<string | null>(null);

  const { data: plansData } = useQuery({
    queryKey: ['apply-plans'],
    queryFn: () => apiClient.get('/api/apply/plans'),
  });

  const { data: userPlanData } = useQuery({
    queryKey: ['apply-user-plan'],
    queryFn: () => apiClient.get('/api/apply/plan'),
  });

  const plans = (plansData as any)?.plans || [];
  const currentPlan = (userPlanData as any)?.plan;

  const setPlanMutation = useMutation({
    mutationFn: (planName: string) =>
      apiClient.post('/api/apply/plan', { planId: planName }),
    onSuccess: () => {
      setSelectingPlanId(null);
      queryClient.invalidateQueries({ queryKey: ['apply-user-plan'] });
      queryClient.invalidateQueries({ queryKey: ['apply-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['apply-plans'] });
      showToast('Plan updated successfully', 'success');
    },
    onError: (error: any) => {
      setSelectingPlanId(null);
      const errorMessage = error?.response?.data?.error || 'Failed to update plan';
      showToast(errorMessage, 'error');
    },
  });

  const handleSelectPlan = (planName: string, planId: string) => {
    setSelectingPlanId(planId);
    setPlanMutation.mutate(planName);
  };

  return (
    <>
      <Helmet>
        <title>Billing & Plans - Apply System - Talents Media</title>
      </Helmet>

      <Navbar />

      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <Link
              to="/apply"
              className="text-tm-text-muted hover:text-tm-text mb-4 inline-block"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
            <p className="text-tm-text-muted">
              Plans control your daily application limits. Select a plan to start auto-applying.
            </p>
          </div>

          {plans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan: any) => {
                const isCurrent = currentPlan?.plan_name === plan.name;
                const features = plan.features?.features || [];

                return (
                  <div
                    key={plan.id}
                    className={`glass-card p-6 relative flex flex-col ${
                      isCurrent ? 'border-2 border-tm-primary-from' : ''
                    }`}
                  >
                    {isCurrent && (
                      <div className="absolute top-4 right-4 px-2 py-1 bg-tm-primary-from text-white text-xs rounded">
                        Current
                      </div>
                    )}
                    <div className="mb-4">
                      <h3 className="text-2xl font-bold mb-1">{plan.display_name}</h3>
                      <div className="text-3xl font-bold mb-1">
                        {plan.price_monthly === 0 ? (
                          'Free'
                        ) : (
                          <>
                            {plan.price_monthly} JD
                            <span className="text-sm font-normal text-tm-text-muted">/month</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-tm-text-muted mb-4">
                        {plan.features?.description || ''}
                      </p>
                    </div>
                    <div className="mb-6 flex-1">
                      <div className="flex items-center gap-2 mb-4">
                        <Zap className="h-5 w-5 text-tm-primary-from" />
                        <span className="font-semibold">
                          {plan.daily_apply_limit} applications/day
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {features.map((feature: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      onClick={() => handleSelectPlan(plan.name, plan.id)}
                      disabled={isCurrent || selectingPlanId !== null}
                      className={`w-full py-3 rounded-lg font-medium transition mt-auto ${
                        isCurrent
                          ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white hover:brightness-110'
                      } disabled:opacity-50`}
                    >
                      {selectingPlanId === plan.id ? (
                        <LoadingSpinner />
                      ) : isCurrent ? (
                        'Current Plan'
                      ) : (
                        'Select Plan'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <LoadingSpinner />
            </div>
          )}

          <div className="mt-8 glass-card p-6">
            <h3 className="text-lg font-semibold mb-2">How Plans Work</h3>
            <p className="text-sm text-tm-text-muted">
              Plans directly control automation behavior. Once you select a plan, auto-apply will
              run daily up to your plan's limit. No manual actions required - just set it and forget
              it!
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

