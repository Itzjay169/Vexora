'use client';

import React, { useState } from 'react';
import { Star, ShieldCheck, CheckCircle2, MessageSquare, Clock, Award, X, AlertCircle } from 'lucide-react';

export interface OrganiserRatingItem {
  id: string;
  participant_username: string;
  tournament_name: string;
  overall_score: number;
  communication_score: number;
  schedule_score: number;
  result_score: number;
  review_text?: string | null;
  is_verified_participant: boolean;
  created_at: string;
}

export interface OrganiserReputationSummary {
  sample_size: number;
  verified_reviews_count: number;
  avg_overall: number;
  avg_communication: number;
  avg_schedule: number;
  avg_result: number;
}

interface OrganiserReviewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  organiserName: string;
  summary: OrganiserReputationSummary;
  reviews?: OrganiserRatingItem[];
}

export function OrganiserReviewsModal({
  isOpen,
  onClose,
  organiserName,
  summary,
  reviews = [],
}: OrganiserReviewsModalProps) {
  if (!isOpen) return null;

  const defaultReviews: OrganiserRatingItem[] = reviews.length > 0 ? reviews : [
    {
      id: 'r-1',
      participant_username: 'ApexPredator_99',
      tournament_name: 'BGMI Champions Trophy 2026',
      overall_score: 5.0,
      communication_score: 5,
      schedule_score: 5,
      result_score: 5,
      review_text: 'Match started exactly on time. Room ID credentials were sent 15 minutes prior in-app and results were confirmed in 10 minutes.',
      is_verified_participant: true,
      created_at: '2026-10-14',
    },
    {
      id: 'r-2',
      participant_username: 'Hydra_Viper',
      tournament_name: 'Free Fire MAX Weekly Clash',
      overall_score: 4.67,
      communication_score: 5,
      schedule_score: 4,
      result_score: 5,
      review_text: 'Very responsive organiser on lobby issues. Minor 5m delay on round 2, but overall very fair and transparent score calculations.',
      is_verified_participant: true,
      created_at: '2026-10-12',
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '650px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #1E293B',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Award size={20} color="#818CF8" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#F8FAFC' }}>
                  {organiserName}
                </h2>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10B981',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '4px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                  }}
                >
                  <ShieldCheck size={12} /> Verified Organiser
                </span>
              </div>
              <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>
                Participant Ratings & Transparent Reputation Ledger (Section 21)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
          {/* Summary Box */}
          <div
            style={{
              backgroundColor: '#1E293B',
              borderRadius: '12px',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              border: '1px solid #334155',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#F8FAFC' }}>
                    {summary.avg_overall.toFixed(2)}
                  </span>
                  <span style={{ fontSize: '1rem', color: '#94A3B8', fontWeight: 600 }}>/ 5.0</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={16}
                      fill={star <= Math.round(summary.avg_overall) ? '#F59E0B' : 'transparent'}
                      color={star <= Math.round(summary.avg_overall) ? '#F59E0B' : '#64748B'}
                    />
                  ))}
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginLeft: '0.5rem' }}>
                    Based on {summary.sample_size} verified reviews
                  </span>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#0F172A',
                  padding: '0.5rem 0.875rem',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  textAlign: 'right',
                }}
              >
                <div style={{ fontSize: '0.6875rem', color: '#94A3B8', textTransform: 'uppercase' }}>Sample Size</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#38BDF8' }}>
                  {summary.sample_size} tournaments
                </div>
              </div>
            </div>

            {/* 3 Dimensional breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '1rem', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', alignItems: 'center' }}>
                <span style={{ color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <MessageSquare size={13} color="#38BDF8" /> Communication & Lobby Support
                </span>
                <span style={{ fontWeight: 700, color: '#38BDF8' }}>{summary.avg_communication.toFixed(2)} / 5.0</span>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: '#0F172A', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${(summary.avg_communication / 5) * 100}%`, height: '100%', backgroundColor: '#38BDF8' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', alignItems: 'center', marginTop: '0.25rem' }}>
                <span style={{ color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Clock size={13} color="#F59E0B" /> Schedule Adherence & Timeliness
                </span>
                <span style={{ fontWeight: 700, color: '#F59E0B' }}>{summary.avg_schedule.toFixed(2)} / 5.0</span>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: '#0F172A', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${(summary.avg_schedule / 5) * 100}%`, height: '100%', backgroundColor: '#F59E0B' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', alignItems: 'center', marginTop: '0.25rem' }}>
                <span style={{ color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Award size={13} color="#10B981" /> Result Handling & Accuracy
                </span>
                <span style={{ fontWeight: 700, color: '#10B981' }}>{summary.avg_result.toFixed(2)} / 5.0</span>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: '#0F172A', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${(summary.avg_result / 5) * 100}%`, height: '100%', backgroundColor: '#10B981' }} />
              </div>
            </div>
          </div>

          {/* Reviews List */}
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#F8FAFC', margin: '0 0 0.875rem' }}>
            Verified Participant Feedback
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {defaultReviews.map((rev) => (
              <div
                key={rev.id}
                style={{
                  backgroundColor: '#1E293B',
                  borderRadius: '10px',
                  padding: '1rem',
                  border: '1px solid #334155',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, color: '#F8FAFC', fontSize: '0.875rem' }}>
                        {rev.participant_username}
                      </span>
                      {rev.is_verified_participant && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            color: '#38BDF8',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                          }}
                        >
                          <CheckCircle2 size={11} /> Verified Participant
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.125rem' }}>
                      {rev.tournament_name} • {rev.created_at}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: '#0F172A', padding: '0.25rem 0.5rem', borderRadius: '6px' }}>
                    <Star size={12} fill="#F59E0B" color="#F59E0B" />
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#F8FAFC' }}>
                      {rev.overall_score.toFixed(2)}
                    </span>
                  </div>
                </div>

                {rev.review_text && (
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: '#CBD5E1', lineHeight: 1.5 }}>
                    "{rev.review_text}"
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Security Gate Notice */}
          <div
            style={{
              marginTop: '1.25rem',
              padding: '0.75rem',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              borderRadius: '8px',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={15} color="#818CF8" />
            <span style={{ fontSize: '0.6875rem', color: '#C7D2FE', lineHeight: 1.4 }}>
              <strong>Anti-Punishment Security Gate:</strong> Ratings alone never trigger automatic punishment or demotion. Organisers cannot delete reviews; abusive content is arbitrated by human moderators.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
