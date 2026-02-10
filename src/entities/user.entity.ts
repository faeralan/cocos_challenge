import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Order } from './order.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column({ name: 'accountnumber' })
  accountnumber: string;

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];
}
