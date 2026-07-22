import { describe, expect, it } from 'vitest';
import { buildTypedDishBody } from '../src/lib/typedQuickAdd';

describe('buildTypedDishBody', () => {
  it('an existing restaurant sets restaurant_id and source:manual', () => {
    const body = buildTypedDishBody('Shrimp Dumpling', '蝦餃', { kind: 'existing', id: 'r1', name: '美心皇宮' }, null);
    expect(body).toEqual({ name: 'Shrimp Dumpling', name_zh: '蝦餃', source: 'manual', restaurant_id: 'r1' });
  });

  it('a brand-new restaurant sets new_restaurant and source:manual', () => {
    const body = buildTypedDishBody('Char Siu', '叉燒', {
      kind: 'new', name: '新發燒臘', lat: 22.28, lng: 114.15, area: '西環', place_id: 'p1',
    }, null);
    expect(body.source).toBe('manual');
    expect(body.new_restaurant).toEqual({ name: '新發燒臘', lat: 22.28, lng: 114.15, area: '西環', address: undefined, place_id: 'p1' });
    expect(body.restaurant_id).toBeUndefined();
  });

  it('the 住家菜 chip sets source:home with no restaurant fields', () => {
    const body = buildTypedDishBody('Fried Rice', '炒飯', { kind: 'home' }, null);
    expect(body.source).toBe('home');
    expect(body.restaurant_id).toBeUndefined();
    expect(body.new_restaurant).toBeUndefined();
  });

  it('an outright skip sets source:manual and carries coords for district lookup', () => {
    const body = buildTypedDishBody('Mystery Noodles', '神秘麵', null, { lat: 22.3, lng: 114.17 });
    expect(body.source).toBe('manual');
    expect(body.lat).toBe(22.3);
    expect(body.lng).toBe(114.17);
  });

  it('coords are dropped once a restaurant is attached (district comes from the restaurant)', () => {
    const body = buildTypedDishBody('Wonton', '雲吞', { kind: 'existing', id: 'r1', name: 'X' }, { lat: 22.3, lng: 114.17 });
    expect(body.lat).toBeUndefined();
    expect(body.lng).toBeUndefined();
  });

  it('home with no coords carries neither lat nor lng', () => {
    const body = buildTypedDishBody('Congee', '粥', { kind: 'home' }, null);
    expect(body.lat).toBeUndefined();
    expect(body.lng).toBeUndefined();
  });

  it('home WITH coords still carries them through (district lookup applies to home dishes too)', () => {
    const body = buildTypedDishBody('Congee', '粥', { kind: 'home' }, { lat: 22.3, lng: 114.17 });
    expect(body.source).toBe('home');
    expect(body.lat).toBe(22.3);
    expect(body.lng).toBe(114.17);
  });
});
